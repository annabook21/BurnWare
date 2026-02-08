/**
 * Link Model
 * Database operations for links
 * File size: ~195 lines
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface Link {
  link_id: string;
  owner_user_id: string;
  display_name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
  burned: boolean;
  message_count: number;
  qr_code_url?: string;
}

export interface CreateLinkData {
  link_id: string;
  owner_user_id: string;
  display_name: string;
  description?: string;
  expires_at?: Date;
  qr_code_url?: string;
}

export class LinkModel {
  private get db(): Pool {
    return getDb();
  }

  /**
   * Create new link (parameterized query for SQL injection prevention)
   */
  async create(data: CreateLinkData): Promise<Link> {
    const query = `
      INSERT INTO links (link_id, owner_user_id, display_name, description, expires_at, qr_code_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.link_id,
        data.owner_user_id,
        data.display_name,
        data.description || null,
        data.expires_at || null,
        data.qr_code_url || null,
      ]);

      return result.rows[0] as Link;
    } catch (error) {
      logger.error('Failed to create link', { error });
      throw new DatabaseError('Failed to create link', error as Error);
    }
  }

  /**
   * Find link by ID (only active, non-expired links)
   */
  async findById(linkId: string): Promise<Link | null> {
    const query = `
      SELECT * FROM links
      WHERE link_id = $1
        AND burned = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;

    try {
      const result = await this.db.query(query, [linkId]);
      return result.rows[0] as Link || null;
    } catch (error) {
      logger.error('Failed to find link', { error, link_id: linkId });
      throw new DatabaseError('Failed to find link', error as Error);
    }
  }

  /**
   * Find all links for a user
   */
  async findByUserId(userId: string, limit: number, offset: number): Promise<Link[]> {
    const query = `
      SELECT * FROM links
      WHERE owner_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.db.query(query, [userId, limit, offset]);
      return result.rows as Link[];
    } catch (error) {
      logger.error('Failed to find user links', { error, user_id: userId });
      throw new DatabaseError('Failed to find user links', error as Error);
    }
  }

  /**
   * Count links for a user
   */
  async countByUserId(userId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM links WHERE owner_user_id = $1';

    try {
      const result = await this.db.query(query, [userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count user links', { error, user_id: userId });
      throw new DatabaseError('Failed to count user links', error as Error);
    }
  }

  /**
   * Update link
   */
  async update(linkId: string, data: Partial<Link>): Promise<Link> {
    const query = `
      UPDATE links
      SET display_name = COALESCE($2, display_name),
          description = COALESCE($3, description),
          expires_at = COALESCE($4, expires_at)
      WHERE link_id = $1
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        linkId,
        data.display_name,
        data.description,
        data.expires_at,
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Link');
      }

      return result.rows[0] as Link;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to update link', { error, link_id: linkId });
      throw new DatabaseError('Failed to update link', error as Error);
    }
  }

  /**
   * Delete link
   */
  async delete(linkId: string): Promise<void> {
    const query = 'DELETE FROM links WHERE link_id = $1';

    try {
      await this.db.query(query, [linkId]);
    } catch (error) {
      logger.error('Failed to delete link', { error, link_id: linkId });
      throw new DatabaseError('Failed to delete link', error as Error);
    }
  }
}
