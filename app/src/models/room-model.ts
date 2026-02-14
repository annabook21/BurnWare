/**
 * Room Model
 * Database operations for secure chat rooms
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface Room {
  room_id: string;
  creator_user_id: string;
  display_name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  locked_at?: Date;
  join_window_minutes: number;
  max_participants: number;
  participant_count: number;
  auto_approve: boolean;
  burned: boolean;
  group_public_key: string;
}

export interface CreateRoomData {
  creator_user_id: string;
  display_name: string;
  description?: string;
  expires_at: Date;
  join_window_minutes?: number;
  max_participants?: number;
  auto_approve?: boolean;
  group_public_key: string;
}

export class RoomModel {
  private get db(): Pool {
    return getDb();
  }

  async create(data: CreateRoomData): Promise<Room> {
    const query = `
      INSERT INTO rooms (
        creator_user_id, display_name, description, expires_at,
        join_window_minutes, max_participants, auto_approve, group_public_key,
        participant_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.creator_user_id,
        data.display_name,
        data.description || null,
        data.expires_at,
        data.join_window_minutes ?? 15,
        data.max_participants ?? 10,
        data.auto_approve ?? false,
        data.group_public_key,
      ]);
      return result.rows[0] as Room;
    } catch (error) {
      logger.error('Failed to create room', { error });
      throw new DatabaseError('Failed to create room', error as Error);
    }
  }

  async findById(roomId: string): Promise<Room | null> {
    const query = 'SELECT * FROM rooms WHERE room_id = $1';

    try {
      const result = await this.db.query(query, [roomId]);
      return (result.rows[0] as Room) || null;
    } catch (error) {
      logger.error('Failed to find room', { error, room_id: roomId });
      throw new DatabaseError('Failed to find room', error as Error);
    }
  }

  async findActiveById(roomId: string): Promise<Room | null> {
    const query = `
      SELECT * FROM rooms
      WHERE room_id = $1
        AND burned = FALSE
        AND expires_at > CURRENT_TIMESTAMP
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return (result.rows[0] as Room) || null;
    } catch (error) {
      logger.error('Failed to find active room', { error, room_id: roomId });
      throw new DatabaseError('Failed to find room', error as Error);
    }
  }

  async findByUserId(userId: string, limit: number, offset: number): Promise<Room[]> {
    const query = `
      SELECT * FROM rooms
      WHERE creator_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.db.query(query, [userId, limit, offset]);
      return result.rows as Room[];
    } catch (error) {
      logger.error('Failed to find user rooms', { error, user_id: userId });
      throw new DatabaseError('Failed to find user rooms', error as Error);
    }
  }

  async countByUserId(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM rooms
      WHERE creator_user_id = $1
        AND burned = FALSE
        AND expires_at > CURRENT_TIMESTAMP
    `;

    try {
      const result = await this.db.query(query, [userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count user rooms', { error, user_id: userId });
      throw new DatabaseError('Failed to count user rooms', error as Error);
    }
  }

  async lock(roomId: string): Promise<Room> {
    const query = `
      UPDATE rooms
      SET locked_at = CURRENT_TIMESTAMP
      WHERE room_id = $1 AND locked_at IS NULL
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Room');
      }
      return result.rows[0] as Room;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to lock room', { error, room_id: roomId });
      throw new DatabaseError('Failed to lock room', error as Error);
    }
  }

  async burn(roomId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Delete messages first (cascading delete doesn't clear content)
      await client.query(
        'DELETE FROM room_messages WHERE room_id = $1',
        [roomId]
      );
      // Delete participants
      await client.query(
        'DELETE FROM room_participants WHERE room_id = $1',
        [roomId]
      );
      // Delete invites
      await client.query(
        'DELETE FROM room_invites WHERE room_id = $1',
        [roomId]
      );
      // Mark room as burned
      await client.query(
        'UPDATE rooms SET burned = TRUE WHERE room_id = $1',
        [roomId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to burn room', { error, room_id: roomId });
      throw new DatabaseError('Failed to burn room', error as Error);
    } finally {
      client.release();
    }
  }

  async isLocked(roomId: string): Promise<boolean> {
    const query = `
      SELECT locked_at IS NOT NULL OR
        created_at + (join_window_minutes || ' minutes')::INTERVAL < CURRENT_TIMESTAMP
        AS is_locked
      FROM rooms WHERE room_id = $1
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows[0]?.is_locked ?? true;
    } catch (error) {
      logger.error('Failed to check room lock status', { error, room_id: roomId });
      throw new DatabaseError('Failed to check room status', error as Error);
    }
  }

  async isFull(roomId: string): Promise<boolean> {
    const query = `
      SELECT participant_count >= max_participants AS is_full
      FROM rooms WHERE room_id = $1
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows[0]?.is_full ?? true;
    } catch (error) {
      logger.error('Failed to check room capacity', { error, room_id: roomId });
      throw new DatabaseError('Failed to check room capacity', error as Error);
    }
  }
}
