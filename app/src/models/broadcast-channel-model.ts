/**
 * Broadcast Channel Model
 * Database operations for broadcast channels
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface BroadcastChannel {
  channel_id: string;
  post_token_hash: string;
  display_name: string;
  created_at: Date;
  expires_at: Date | null;
  burned: boolean;
  owner_user_id: string | null;
  qr_code_url: string | null;
  allow_guest_posts: boolean;
}

export interface CreateBroadcastChannelData {
  channel_id: string;
  post_token_hash: string;
  display_name: string;
  expires_at?: Date | null;
  owner_user_id?: string | null;
  qr_code_url?: string | null;
  allow_guest_posts?: boolean;
}

export class BroadcastChannelModel {
  private get db(): Pool {
    return getDb();
  }

  async create(data: CreateBroadcastChannelData): Promise<BroadcastChannel> {
    const query = `
      INSERT INTO broadcast_channels (
        channel_id, post_token_hash, display_name, expires_at, owner_user_id, qr_code_url, allow_guest_posts
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.channel_id,
        data.post_token_hash,
        data.display_name,
        data.expires_at ?? null,
        data.owner_user_id ?? null,
        data.qr_code_url ?? null,
        data.allow_guest_posts ?? false,
      ]);
      return result.rows[0] as BroadcastChannel;
    } catch (error) {
      logger.error('Failed to create broadcast channel', { error, channel_id: data.channel_id });
      throw new DatabaseError('Failed to create channel', error as Error);
    }
  }

  async findByChannelId(channelId: string): Promise<BroadcastChannel | null> {
    const query = 'SELECT * FROM broadcast_channels WHERE channel_id = $1';

    try {
      const result = await this.db.query(query, [channelId]);
      return (result.rows[0] as BroadcastChannel) || null;
    } catch (error) {
      logger.error('Failed to find broadcast channel', { error, channel_id: channelId });
      throw new DatabaseError('Failed to find channel', error as Error);
    }
  }

  async findByOwnerUserId(userId: string): Promise<BroadcastChannel[]> {
    const query = `
      SELECT * FROM broadcast_channels
      WHERE owner_user_id = $1
      ORDER BY burned ASC, created_at DESC
    `;

    try {
      const result = await this.db.query(query, [userId]);
      return result.rows as BroadcastChannel[];
    } catch (error) {
      logger.error('Failed to list broadcast channels by owner', { error, user_id: userId });
      throw new DatabaseError('Failed to list channels', error as Error);
    }
  }

  async delete(channelId: string, ownerUserId: string): Promise<boolean> {
    const query = `
      DELETE FROM broadcast_channels
      WHERE channel_id = $1 AND owner_user_id = $2
    `;

    try {
      const result = await this.db.query(query, [channelId, ownerUserId]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to delete broadcast channel', { error, channel_id: channelId });
      throw new DatabaseError('Failed to delete channel', error as Error);
    }
  }

  async burn(channelId: string): Promise<void> {
    const query = `
      UPDATE broadcast_channels SET burned = TRUE WHERE channel_id = $1
    `;

    try {
      const result = await this.db.query(query, [channelId]);
      if (result.rowCount === 0) {
        throw new NotFoundError('Broadcast channel');
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to burn broadcast channel', { error, channel_id: channelId });
      throw new DatabaseError('Failed to burn channel', error as Error);
    }
  }
}
