/**
 * Room Message Model
 * Database operations for encrypted room messages
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError } from '../utils/error-utils';
import { logger } from '../config/logger';

export interface RoomMessage {
  message_id: string;
  room_id: string;
  participant_id: string;
  ciphertext: string;
  nonce: string;
  created_at: Date;
}

export interface CreateRoomMessageData {
  room_id: string;
  participant_id: string;
  ciphertext: string;
  nonce: string;
}

export interface RoomMessageWithSender extends RoomMessage {
  anonymous_id: string;
  display_name?: string;
}

export class RoomMessageModel {
  private get db(): Pool {
    return getDb();
  }

  async create(data: CreateRoomMessageData): Promise<RoomMessage> {
    const query = `
      INSERT INTO room_messages (room_id, participant_id, ciphertext, nonce)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        data.room_id,
        data.participant_id,
        data.ciphertext,
        data.nonce,
      ]);
      return result.rows[0] as RoomMessage;
    } catch (error) {
      logger.error('Failed to create room message', { error, room_id: data.room_id });
      throw new DatabaseError('Failed to create message', error as Error);
    }
  }

  async findByRoomId(
    roomId: string,
    limit: number,
    offset: number
  ): Promise<RoomMessageWithSender[]> {
    const query = `
      SELECT m.*, p.anonymous_id, p.display_name
      FROM room_messages m
      JOIN room_participants p ON m.participant_id = p.participant_id
      WHERE m.room_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.db.query(query, [roomId, limit, offset]);
      return result.rows as RoomMessageWithSender[];
    } catch (error) {
      logger.error('Failed to find room messages', { error, room_id: roomId });
      throw new DatabaseError('Failed to find messages', error as Error);
    }
  }

  /**
   * Find messages after a cursor (timestamp + message_id)
   * Uses row value comparison for proper cursor-based pagination
   */
  async findAfterCursor(
    roomId: string,
    cursorTime: Date,
    cursorMessageId: string,
    limit: number = 100
  ): Promise<RoomMessageWithSender[]> {
    // Row value comparison ensures no duplicates even with identical timestamps
    const query = `
      SELECT m.*, p.anonymous_id, p.display_name
      FROM room_messages m
      JOIN room_participants p ON m.participant_id = p.participant_id
      WHERE m.room_id = $1 AND (m.created_at, m.message_id) > ($2, $3)
      ORDER BY m.created_at ASC, m.message_id ASC
      LIMIT $4
    `;

    try {
      const result = await this.db.query(query, [roomId, cursorTime, cursorMessageId, limit]);
      return result.rows as RoomMessageWithSender[];
    } catch (error) {
      logger.error('Failed to find messages after cursor', { error, room_id: roomId });
      throw new DatabaseError('Failed to find messages', error as Error);
    }
  }

  /**
   * @deprecated Use findAfterCursor for proper cursor-based pagination
   */
  async findSinceTimestamp(
    roomId: string,
    since: Date,
    limit: number = 100
  ): Promise<RoomMessageWithSender[]> {
    const query = `
      SELECT m.*, p.anonymous_id, p.display_name
      FROM room_messages m
      JOIN room_participants p ON m.participant_id = p.participant_id
      WHERE m.room_id = $1 AND m.created_at > $2
      ORDER BY m.created_at ASC
      LIMIT $3
    `;

    try {
      const result = await this.db.query(query, [roomId, since, limit]);
      return result.rows as RoomMessageWithSender[];
    } catch (error) {
      logger.error('Failed to find messages since timestamp', { error, room_id: roomId });
      throw new DatabaseError('Failed to find messages', error as Error);
    }
  }

  async countByRoomId(roomId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM room_messages WHERE room_id = $1';

    try {
      const result = await this.db.query(query, [roomId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count room messages', { error, room_id: roomId });
      throw new DatabaseError('Failed to count messages', error as Error);
    }
  }

  async deleteByRoomId(roomId: string): Promise<void> {
    const query = 'DELETE FROM room_messages WHERE room_id = $1';

    try {
      await this.db.query(query, [roomId]);
    } catch (error) {
      logger.error('Failed to delete room messages', { error, room_id: roomId });
      throw new DatabaseError('Failed to delete messages', error as Error);
    }
  }
}
