/**
 * Message Model
 * Database operations for messages
 * File size: ~155 lines
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface Message {
  message_id: string;
  thread_id: string;
  content: string;
  created_at: Date;
  sender_type: 'anonymous' | 'owner';
  sender_id?: string;
  ip_hash?: string;
}

export interface CreateMessageData {
  thread_id: string;
  content: string;
  sender_type: 'anonymous' | 'owner';
  sender_id?: string;
  ip_hash?: string;
}

export class MessageModel {
  private db: Pool;

  constructor() {
    this.db = getDb();
  }

  /**
   * Create new message
   */
  async create(data: CreateMessageData): Promise<Message> {
    const query = `
      INSERT INTO messages (thread_id, content, sender_type, sender_id, ip_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.thread_id,
        data.content,
        data.sender_type,
        data.sender_id || null,
        data.ip_hash || null,
      ]);

      return result.rows[0] as Message;
    } catch (error) {
      logger.error('Failed to create message', { error });
      throw new DatabaseError('Failed to create message', error as Error);
    }
  }

  /**
   * Find messages by thread ID
   */
  async findByThreadId(threadId: string, limit: number, offset: number): Promise<Message[]> {
    const query = `
      SELECT message_id, thread_id, content, created_at, sender_type
      FROM messages
      WHERE thread_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.db.query(query, [threadId, limit, offset]);
      return result.rows as Message[];
    } catch (error) {
      logger.error('Failed to find messages', { error, thread_id: threadId });
      throw new DatabaseError('Failed to find messages', error as Error);
    }
  }

  /**
   * Count messages in thread
   */
  async countByThreadId(threadId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM messages WHERE thread_id = $1';

    try {
      const result = await this.db.query(query, [threadId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count messages', { error, thread_id: threadId });
      throw new DatabaseError('Failed to count messages', error as Error);
    }
  }

  /**
   * Delete messages in thread (when thread is burned)
   */
  async deleteByThreadId(threadId: string): Promise<void> {
    const query = 'DELETE FROM messages WHERE thread_id = $1';

    try {
      await this.db.query(query, [threadId]);
    } catch (error) {
      logger.error('Failed to delete messages', { error, thread_id: threadId });
      throw new DatabaseError('Failed to delete messages', error as Error);
    }
  }
}
