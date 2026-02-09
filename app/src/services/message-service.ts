/**
 * Message Service
 * Business logic for message handling
 * File size: ~240 lines
 */

import { MessageModel, Message, CreateMessageData } from '../models/message-model';
import { ThreadModel } from '../models/thread-model';
import { LinkModel } from '../models/link-model';
import { CryptoUtils } from '../utils/crypto-utils';
import { TokenService } from './token-service';
import { ThreadService } from './thread-service';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { AppSyncPublisher } from './appsync-publisher';

export interface SendMessageInput {
  recipient_link_id: string;
  // E2EE (new links with public_key)
  ciphertext?: string;
  sender_public_key?: string;
  // Legacy plaintext (links without public_key)
  message?: string;
  // OPSEC passphrase (required for passphrase-gated links)
  passphrase?: string;
}

export class MessageService {
  private messageModel: MessageModel;
  private threadModel: ThreadModel;
  private linkModel: LinkModel;
  private threadService: ThreadService;
  private publisher: AppSyncPublisher;

  constructor() {
    this.messageModel = new MessageModel();
    this.threadModel = new ThreadModel();
    this.linkModel = new LinkModel();
    this.threadService = new ThreadService();
    this.publisher = new AppSyncPublisher();
  }

  /**
   * Send anonymous message to link.
   * For OPSEC links: returns access_token and opsec metadata alongside thread_id.
   */
  async sendAnonymousMessage(input: SendMessageInput): Promise<{
    thread_id: string;
    created_at: Date;
    access_token?: string;
    opsec?: { expires_at: Date; access_mode: string; passphrase_required: boolean };
  }> {
    const { recipient_link_id, ciphertext, sender_public_key, message } = input;
    const content = ciphertext || message;
    if (!content) {
      throw new ValidationError('Message content is required');
    }

    // Validate link exists and is active
    const link = await this.linkModel.findById(recipient_link_id);
    if (!link) {
      throw new NotFoundError('Link');
    }

    if (TokenService.isExpired(link.expires_at)) {
      throw new ValidationError('Link has expired');
    }

    if (link.burned) {
      throw new ValidationError('Link is no longer active');
    }

    // OPSEC: verify passphrase before allowing send
    if (link.opsec_passphrase_hash) {
      if (!input.passphrase) {
        throw new ValidationError('This link requires a passphrase');
      }
      const isValid = await CryptoUtils.pbkdf2Verify(
        input.passphrase, link.opsec_passphrase_hash, link.opsec_passphrase_salt!
      );
      if (!isValid) {
        throw new AuthorizationError('Incorrect passphrase');
      }
    }

    // Create new thread (OPSEC settings applied inside createThread)
    const { thread, accessToken } = await this.threadService.createThread(recipient_link_id, sender_public_key);

    if (thread.burned) {
      throw new ValidationError('Thread has been burned by the recipient');
    }

    const messageData: CreateMessageData = {
      thread_id: thread.thread_id,
      content,
      sender_type: 'anonymous',
    };

    const newMessage = await this.messageModel.create(messageData);

    LoggerUtils.logMetric('message_sent', 1, 'count');
    LoggerUtils.logMetric('anonymous_message_sent', 1, 'count');

    logger.info('Anonymous message sent', {
      thread_id: thread.thread_id,
      link_id: recipient_link_id,
      message_id: newMessage.message_id,
    });

    // Fire-and-forget: notify subscribers via AppSync Events
    this.publisher.publishNewMessage(thread.thread_id, recipient_link_id, 'anonymous').catch(() => {});

    return {
      thread_id: thread.thread_id,
      created_at: newMessage.created_at,
      access_token: accessToken,
      ...(link.opsec_mode && thread.expires_at && {
        opsec: {
          expires_at: thread.expires_at,
          access_mode: link.opsec_access || 'device_bound',
          passphrase_required: !!thread.passphrase_hash,
        },
      }),
    };
  }

  /**
   * Send anonymous follow-up message to existing thread.
   * For OPSEC threads: verifies access token and expiry.
   */
  async sendAnonymousReply(
    threadId: string,
    content: string,
    accessToken?: string,
  ): Promise<Message> {
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread');
    }

    if (thread.burned) {
      throw new ValidationError('Thread has been burned');
    }

    // OPSEC: check expiry
    if (TokenService.isExpired(thread.expires_at)) {
      throw new ValidationError('Thread has expired');
    }

    // OPSEC: verify access token
    if (thread.access_token_hash) {
      if (!accessToken || CryptoUtils.hash(accessToken) !== thread.access_token_hash) {
        throw new AuthorizationError('Invalid access token');
      }
    }

    const link = await this.linkModel.findById(thread.link_id);
    if (!link || link.burned) {
      throw new NotFoundError('Thread');
    }

    const messageData: CreateMessageData = {
      thread_id: threadId,
      content,
      sender_type: 'anonymous',
    };

    const message = await this.messageModel.create(messageData);

    LoggerUtils.logMetric('message_sent', 1, 'count');
    LoggerUtils.logMetric('anonymous_reply_sent', 1, 'count');

    // Fire-and-forget: notify subscribers via AppSync Events
    this.publisher.publishNewMessage(threadId, link.link_id, 'anonymous').catch(() => {});

    return message;
  }

  /**
   * Send owner reply to thread
   */
  async sendOwnerReply(
    threadId: string,
    userId: string,
    messageContent: string
  ): Promise<Message> {
    // Get thread and verify ownership
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread');
    }

    const link = await this.linkModel.findById(thread.link_id);
    if (!link || link.owner_user_id !== userId) {
      throw new NotFoundError('Thread');
    }

    // Check if thread is burned
    if (thread.burned) {
      throw new ValidationError('Cannot reply to burned thread');
    }

    // Create message
    const messageData: CreateMessageData = {
      thread_id: threadId,
      content: messageContent,
      sender_type: 'owner',
      sender_id: userId,
    };

    const message = await this.messageModel.create(messageData);

    LoggerUtils.logMetric('message_sent', 1, 'count');
    LoggerUtils.logMetric('owner_reply_sent', 1, 'count');

    // Fire-and-forget: notify subscribers via AppSync Events
    this.publisher.publishNewMessage(threadId, link.link_id, 'owner').catch(() => {});

    return message;
  }

  /**
   * Get messages in thread
   */
  async getThreadMessages(
    threadId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ messages: Message[]; total: number }> {
    const offset = (page - 1) * limit;
    const messages = await this.messageModel.findByThreadId(threadId, limit, offset);
    const total = await this.messageModel.countByThreadId(threadId);

    return { messages, total };
  }

}
