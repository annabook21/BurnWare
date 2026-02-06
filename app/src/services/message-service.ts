/**
 * Message Service
 * Business logic for message handling
 * File size: ~240 lines
 */

import { MessageModel, Message, CreateMessageData } from '../models/message-model';
import { ThreadModel } from '../models/thread-model';
import { LinkModel } from '../models/link-model';
import { TokenService } from './token-service';
import { ThreadService } from './thread-service';
import { ValidationError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { LoggerUtils } from '../utils/logger-utils';

export interface SendMessageInput {
  recipient_link_id: string;
  message: string;
  sender_ip: string;
  user_agent: string;
}

export class MessageService {
  private messageModel: MessageModel;
  private threadModel: ThreadModel;
  private linkModel: LinkModel;
  private threadService: ThreadService;

  constructor() {
    this.messageModel = new MessageModel();
    this.threadModel = new ThreadModel();
    this.linkModel = new LinkModel();
    this.threadService = new ThreadService();
  }

  /**
   * Send anonymous message to link
   */
  async sendAnonymousMessage(input: SendMessageInput): Promise<{
    thread_id: string;
    created_at: Date;
  }> {
    const { recipient_link_id, message, sender_ip, user_agent } = input;

    // Validate link exists and is active
    const link = await this.linkModel.findById(recipient_link_id);
    if (!link) {
      throw new NotFoundError('Link');
    }

    // Check if link is expired
    if (TokenService.isExpired(link.expires_at)) {
      throw new ValidationError('Link has expired');
    }

    // Check if link is burned
    if (link.burned) {
      throw new ValidationError('Link is no longer active');
    }

    // Generate anonymous sender ID
    const anonymousId = TokenService.generateAnonymousId(sender_ip, user_agent);

    // Check if thread exists for this sender
    let thread = await this.findThreadBySenderId(recipient_link_id, anonymousId);

    if (!thread) {
      // Create new thread
      thread = await this.threadService.createThread(recipient_link_id, sender_ip, user_agent);
    }

    // Check if thread is burned
    if (thread.burned) {
      throw new ValidationError('Thread has been burned by the recipient');
    }

    // Hash IP for storage
    const ipHash = TokenService.hashIP(sender_ip);

    // Create message
    const messageData: CreateMessageData = {
      thread_id: thread.thread_id,
      content: message,
      sender_type: 'anonymous',
      ip_hash: ipHash,
    };

    const newMessage = await this.messageModel.create(messageData);

    LoggerUtils.logMetric('message_sent', 1, 'count');
    LoggerUtils.logMetric('anonymous_message_sent', 1, 'count');

    logger.info('Anonymous message sent', {
      thread_id: thread.thread_id,
      link_id: recipient_link_id,
      message_id: newMessage.message_id,
    });

    return {
      thread_id: thread.thread_id,
      created_at: newMessage.created_at,
    };
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

  /**
   * Find existing thread by sender ID
   */
  private async findThreadBySenderId(
    linkId: string,
    anonymousId: string
  ): Promise<Thread | null> {
    // This is a simplified version - in production, you'd query by sender_anonymous_id
    // For now, we'll create new thread each time (or implement proper lookup)
    return null;
  }
}
