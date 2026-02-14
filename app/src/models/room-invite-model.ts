/**
 * Room Invite Model
 * Database operations for room invite tokens
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface RoomInvite {
  invite_id: string;
  room_id: string;
  invite_token_hash: string;
  label?: string;
  created_at: Date;
  expires_at: Date;
  redeemed_at?: Date;
  revoked: boolean;
}

export interface CreateInviteData {
  room_id: string;
  invite_token_hash: string;
  label?: string;
  expires_at: Date;
}

export class RoomInviteModel {
  private get db(): Pool {
    return getDb();
  }

  async create(data: CreateInviteData): Promise<RoomInvite> {
    const query = `
      INSERT INTO room_invites (room_id, invite_token_hash, label, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.room_id,
        data.invite_token_hash,
        data.label || null,
        data.expires_at,
      ]);
      return result.rows[0] as RoomInvite;
    } catch (error) {
      logger.error('Failed to create room invite', { error, room_id: data.room_id });
      throw new DatabaseError('Failed to create invite', error as Error);
    }
  }

  async createMany(invites: CreateInviteData[]): Promise<RoomInvite[]> {
    if (invites.length === 0) return [];

    const values: unknown[] = [];
    const placeholders = invites.map((inv, i) => {
      const offset = i * 4;
      values.push(inv.room_id, inv.invite_token_hash, inv.label || null, inv.expires_at);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });

    const query = `
      INSERT INTO room_invites (room_id, invite_token_hash, label, expires_at)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, values);
      return result.rows as RoomInvite[];
    } catch (error) {
      logger.error('Failed to create room invites', { error });
      throw new DatabaseError('Failed to create invites', error as Error);
    }
  }

  async findByTokenHash(tokenHash: string): Promise<RoomInvite | null> {
    const query = 'SELECT * FROM room_invites WHERE invite_token_hash = $1';

    try {
      const result = await this.db.query(query, [tokenHash]);
      return (result.rows[0] as RoomInvite) || null;
    } catch (error) {
      logger.error('Failed to find invite by token hash', { error });
      throw new DatabaseError('Failed to find invite', error as Error);
    }
  }

  async findValidByTokenHash(tokenHash: string): Promise<RoomInvite | null> {
    const query = `
      SELECT * FROM room_invites
      WHERE invite_token_hash = $1
        AND redeemed_at IS NULL
        AND revoked = FALSE
        AND expires_at > CURRENT_TIMESTAMP
    `;

    try {
      const result = await this.db.query(query, [tokenHash]);
      return (result.rows[0] as RoomInvite) || null;
    } catch (error) {
      logger.error('Failed to find valid invite', { error });
      throw new DatabaseError('Failed to find invite', error as Error);
    }
  }

  async findByRoomId(roomId: string): Promise<RoomInvite[]> {
    const query = `
      SELECT * FROM room_invites
      WHERE room_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows as RoomInvite[];
    } catch (error) {
      logger.error('Failed to find room invites', { error, room_id: roomId });
      throw new DatabaseError('Failed to find invites', error as Error);
    }
  }

  async redeem(inviteId: string): Promise<RoomInvite> {
    const query = `
      UPDATE room_invites
      SET redeemed_at = CURRENT_TIMESTAMP
      WHERE invite_id = $1
        AND redeemed_at IS NULL
        AND revoked = FALSE
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [inviteId]);
      if (result.rows.length === 0) {
        throw new DatabaseError('Invite already redeemed or revoked');
      }
      return result.rows[0] as RoomInvite;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      logger.error('Failed to redeem invite', { error, invite_id: inviteId });
      throw new DatabaseError('Failed to redeem invite', error as Error);
    }
  }

  async revoke(inviteId: string): Promise<void> {
    const query = `
      UPDATE room_invites
      SET revoked = TRUE
      WHERE invite_id = $1
    `;

    try {
      await this.db.query(query, [inviteId]);
    } catch (error) {
      logger.error('Failed to revoke invite', { error, invite_id: inviteId });
      throw new DatabaseError('Failed to revoke invite', error as Error);
    }
  }

  /** Revoke only if the invite belongs to the given room (prevents cross-room revoke). */
  async revokeForRoom(roomId: string, inviteId: string): Promise<number> {
    const query = `
      UPDATE room_invites
      SET revoked = TRUE
      WHERE invite_id = $1 AND room_id = $2
    `;

    try {
      const result = await this.db.query(query, [inviteId, roomId]);
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('Failed to revoke invite', { error, invite_id: inviteId, room_id: roomId });
      throw new DatabaseError('Failed to revoke invite', error as Error);
    }
  }

  async countByRoomId(roomId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM room_invites WHERE room_id = $1';

    try {
      const result = await this.db.query(query, [roomId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count room invites', { error, room_id: roomId });
      throw new DatabaseError('Failed to count invites', error as Error);
    }
  }
}
