/**
 * Thread Model
 * Database operations for threads
 * File size: ~175 lines
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface Thread {
  thread_id: string;
  link_id: string;
  created_at: Date;
  updated_at: Date;
  burned: boolean;
  message_count: number;
  sender_anonymous_id: string;
  sender_public_key?: string;
  expires_at?: Date;
  access_token_hash?: string;
  passphrase_hash?: string;
  passphrase_salt?: string;
}

export interface CreateThreadData {
  link_id: string;
  sender_anonymous_id: string;
  sender_public_key?: string;
  expires_at?: Date;
  access_token_hash?: string;
  passphrase_hash?: string;
  passphrase_salt?: string;
}

export class ThreadModel {
  private get db(): Pool {
    return getDb();
  }

  /**
   * Create new thread
   */
  async create(data: CreateThreadData): Promise<Thread> {
    const query = `
      INSERT INTO threads (link_id, sender_anonymous_id, sender_public_key,
        expires_at, access_token_hash, passphrase_hash, passphrase_salt)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.link_id, data.sender_anonymous_id, data.sender_public_key || null,
        data.expires_at || null, data.access_token_hash || null,
        data.passphrase_hash || null, data.passphrase_salt || null,
      ]);
      return result.rows[0] as Thread;
    } catch (error) {
      logger.error('Failed to create thread', { error });
      throw new DatabaseError('Failed to create thread', error as Error);
    }
  }

  /**
   * Find thread by ID
   */
  async findById(threadId: string): Promise<Thread | null> {
    const query = 'SELECT * FROM threads WHERE thread_id = $1';

    try {
      const result = await this.db.query(query, [threadId]);
      return result.rows[0] as Thread || null;
    } catch (error) {
      logger.error('Failed to find thread', { error, thread_id: threadId });
      throw new DatabaseError('Failed to find thread', error as Error);
    }
  }

  /**
   * Find threads by link ID
   */
  async findByLinkId(linkId: string, limit: number, offset: number): Promise<Thread[]> {
    const query = `
      SELECT * FROM threads
      WHERE link_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.db.query(query, [linkId, limit, offset]);
      return result.rows as Thread[];
    } catch (error) {
      logger.error('Failed to find threads by link', { error, link_id: linkId });
      throw new DatabaseError('Failed to find threads', error as Error);
    }
  }

  /**
   * Count threads for a link
   */
  async countByLinkId(linkId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM threads WHERE link_id = $1';

    try {
      const result = await this.db.query(query, [linkId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count threads', { error, link_id: linkId });
      throw new DatabaseError('Failed to count threads', error as Error);
    }
  }

  /**
   * Burn thread (soft delete)
   */
  async burn(threadId: string): Promise<Thread> {
    const query = `
      UPDATE threads
      SET burned = TRUE
      WHERE thread_id = $1
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [threadId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Thread');
      }

      return result.rows[0] as Thread;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to burn thread', { error, thread_id: threadId });
      throw new DatabaseError('Failed to burn thread', error as Error);
    }
  }
}
