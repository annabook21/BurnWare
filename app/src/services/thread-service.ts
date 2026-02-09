/**
 * Thread Service
 * Business logic for thread management
 * File size: ~215 lines
 */

import { ThreadModel, Thread, CreateThreadData } from '../models/thread-model';
import { MessageModel, Message } from '../models/message-model';
import { LinkModel } from '../models/link-model';
import { CryptoUtils } from '../utils/crypto-utils';
import { NotFoundError, AuthorizationError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { getDb } from '../config/database';

export class ThreadService {
  private threadModel: ThreadModel;
  private messageModel: MessageModel;
  private linkModel: LinkModel;

  constructor() {
    this.threadModel = new ThreadModel();
    this.messageModel = new MessageModel();
    this.linkModel = new LinkModel();
  }

  /**
   * Create new thread (when anonymous user sends first message).
   * For OPSEC links: sets 24h expiry, generates access token, copies passphrase settings.
   */
  async createThread(
    linkId: string,
    senderPublicKey?: string,
  ): Promise<{ thread: Thread; accessToken?: string }> {
    // Verify link exists and is active
    const link = await this.linkModel.findById(linkId);
    if (!link) {
      throw new NotFoundError('Link');
    }

    // Generate random anonymous sender ID (not derived from IP/UA for privacy)
    const anonymousId = CryptoUtils.generateRandomString(8);

    // OPSEC: generate access token and set expiry if link has opsec_mode
    let accessToken: string | undefined;
    let accessTokenHash: string | undefined;
    if (link.opsec_mode) {
      accessToken = CryptoUtils.generateRandomString(32); // 64-char hex
      accessTokenHash = CryptoUtils.hash(accessToken);
    }

    const threadData: CreateThreadData = {
      link_id: linkId,
      sender_anonymous_id: anonymousId,
      sender_public_key: senderPublicKey,
      expires_at: link.opsec_mode ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
      access_token_hash: accessTokenHash,
      passphrase_hash: link.opsec_mode ? link.opsec_passphrase_hash : undefined,
      passphrase_salt: link.opsec_mode ? link.opsec_passphrase_salt : undefined,
    };

    const thread = await this.threadModel.create(threadData);

    LoggerUtils.logMetric('thread_created', 1, 'count');

    return { thread, accessToken };
  }

  /**
   * Get thread by ID
   */
  async getThreadById(threadId: string): Promise<Thread> {
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundError('Thread');
    }

    return thread;
  }

  /**
   * Get threads for a link (owner view)
   */
  async getThreadsByLinkId(
    linkId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ threads: Thread[]; total: number }> {
    // Verify link ownership
    const link = await this.linkModel.findById(linkId);
    if (!link) {
      throw new NotFoundError('Link');
    }

    if (link.owner_user_id !== userId) {
      throw new AuthorizationError('Not authorized to view these threads');
    }

    // Get threads
    const offset = (page - 1) * limit;
    const threads = await this.threadModel.findByLinkId(linkId, limit, offset);
    const total = await this.threadModel.countByLinkId(linkId);

    return { threads, total };
  }

  /**
   * Get thread with messages (owner view)
   */
  async getThreadWithMessages(
    threadId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    thread: Thread;
    messages: Message[];
    total_messages: number;
  }> {
    // Get thread
    const thread = await this.getThreadById(threadId);

    // Verify ownership
    const link = await this.linkModel.findById(thread.link_id);
    if (!link || link.owner_user_id !== userId) {
      throw new AuthorizationError('Not authorized to view this thread');
    }

    // Get messages
    const offset = (page - 1) * limit;
    const messages = await this.messageModel.findByThreadId(threadId, limit, offset);
    const totalMessages = await this.messageModel.countByThreadId(threadId);

    return {
      thread,
      messages,
      total_messages: totalMessages,
    };
  }

  /**
   * Burn thread (owner action) — atomic transaction
   */
  async burnThread(threadId: string, userId: string): Promise<void> {
    // Get thread
    const thread = await this.getThreadById(threadId);

    // Verify ownership
    const link = await this.linkModel.findById(thread.link_id);
    if (!link || link.owner_user_id !== userId) {
      throw new AuthorizationError('Not authorized to burn this thread');
    }

    // Check if already burned
    if (thread.burned) {
      logger.info('Thread already burned', { thread_id: threadId });
      return;
    }

    // Atomic: delete messages + mark burned + decrement link counter in single transaction
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM messages WHERE thread_id = $1', [threadId]);
      await client.query(
        'UPDATE links SET message_count = GREATEST(message_count - $1, 0) WHERE link_id = $2',
        [thread.message_count, thread.link_id]
      );
      await client.query('UPDATE threads SET burned = TRUE, message_count = 0 WHERE thread_id = $1', [threadId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    LoggerUtils.logMetric('thread_burned', 1, 'count');
    LoggerUtils.logSecurityEvent('thread_burned', {
      thread_id: threadId,
      user_id: userId,
      link_id: thread.link_id,
    });

    logger.info('Thread burned successfully', {
      thread_id: threadId,
      user_id: userId,
    });
  }
}
