/**
 * Broadcast Post Model
 * Database operations for broadcast posts
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface BroadcastPost {
  post_id: string;
  channel_id: string;
  content: string;
  created_at: Date;
}

export interface CreateBroadcastPostData {
  channel_id: string;
  content: string;
}

export class BroadcastPostModel {
  private get db(): Pool {
    return getDb();
  }

  async create(data: CreateBroadcastPostData): Promise<BroadcastPost> {
    const query = `
      INSERT INTO broadcast_posts (channel_id, content)
      VALUES ($1, $2)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [data.channel_id, data.content]);
      return result.rows[0] as BroadcastPost;
    } catch (error) {
      logger.error('Failed to create broadcast post', { error, channel_id: data.channel_id });
      throw new DatabaseError('Failed to create post', error as Error);
    }
  }

  /**
   * List posts newest first; optional cursor before=<post_id>
   */
  async listByChannelId(
    channelId: string,
    limit: number = 50,
    beforePostId?: string
  ): Promise<BroadcastPost[]> {
    let query: string;
    let params: unknown[];

    if (beforePostId) {
      query = `
        SELECT * FROM broadcast_posts
        WHERE channel_id = $1 AND post_id != $2
        AND (created_at, post_id) < (
          SELECT created_at, post_id FROM broadcast_posts
          WHERE channel_id = $1 AND post_id = $2
        )
        ORDER BY created_at DESC, post_id DESC
        LIMIT $3
      `;
      params = [channelId, beforePostId, limit];
    } else {
      query = `
        SELECT * FROM broadcast_posts
        WHERE channel_id = $1
        ORDER BY created_at DESC, post_id DESC
        LIMIT $2
      `;
      params = [channelId, limit];
    }

    try {
      const result = await this.db.query(query, params);
      return result.rows as BroadcastPost[];
    } catch (error) {
      logger.error('Failed to list broadcast posts', { error, channel_id: channelId });
      throw new DatabaseError('Failed to list posts', error as Error);
    }
  }

  async findPostById(postId: string): Promise<{ created_at: Date } | null> {
    const query = 'SELECT created_at FROM broadcast_posts WHERE post_id = $1';

    try {
      const result = await this.db.query(query, [postId]);
      return (result.rows[0] as { created_at: Date }) || null;
    } catch (error) {
      logger.error('Failed to find broadcast post', { error, post_id: postId });
      throw new DatabaseError('Failed to find post', error as Error);
    }
  }
}
