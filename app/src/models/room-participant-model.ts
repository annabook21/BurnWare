/**
 * Room Participant Model
 * Database operations for room participants
 */

import { Pool } from 'pg';
import { getDb } from '../config/database';
import { DatabaseError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';

export type ParticipantStatus = 'pending' | 'approved' | 'rejected';

export interface RoomParticipant {
  participant_id: string;
  room_id: string;
  invite_id?: string;
  anonymous_id: string;
  display_name?: string;
  public_key: string;
  wrapped_group_key?: string;
  status: ParticipantStatus;
  joined_at?: Date;
  watermark_seed: string;
  is_creator: boolean;
  created_at: Date;
}

export interface CreateParticipantData {
  room_id: string;
  invite_id?: string;
  anonymous_id: string;
  display_name?: string;
  public_key: string;
  wrapped_group_key?: string;
  status?: ParticipantStatus;
  watermark_seed: string;
  is_creator?: boolean;
}

export class RoomParticipantModel {
  private get db(): Pool {
    return getDb();
  }

  async create(data: CreateParticipantData): Promise<RoomParticipant> {
    const query = `
      INSERT INTO room_participants (
        room_id, invite_id, anonymous_id, display_name, public_key,
        wrapped_group_key, status, watermark_seed, is_creator, joined_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const isCreator = data.is_creator ?? false;
    const status = data.status ?? (isCreator ? 'approved' : 'pending');

    try {
      const result = await this.db.query(query, [
        data.room_id,
        data.invite_id || null,
        data.anonymous_id,
        data.display_name || null,
        data.public_key,
        data.wrapped_group_key || null,
        status,
        data.watermark_seed,
        isCreator,
        isCreator ? new Date() : null,
      ]);
      return result.rows[0] as RoomParticipant;
    } catch (error) {
      logger.error('Failed to create room participant', { error, room_id: data.room_id });
      throw new DatabaseError('Failed to create participant', error as Error);
    }
  }

  async findById(participantId: string): Promise<RoomParticipant | null> {
    const query = 'SELECT * FROM room_participants WHERE participant_id = $1';

    try {
      const result = await this.db.query(query, [participantId]);
      return (result.rows[0] as RoomParticipant) || null;
    } catch (error) {
      logger.error('Failed to find participant', { error, participant_id: participantId });
      throw new DatabaseError('Failed to find participant', error as Error);
    }
  }

  async findByRoomId(roomId: string): Promise<RoomParticipant[]> {
    const query = `
      SELECT * FROM room_participants
      WHERE room_id = $1
      ORDER BY created_at ASC
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows as RoomParticipant[];
    } catch (error) {
      logger.error('Failed to find room participants', { error, room_id: roomId });
      throw new DatabaseError('Failed to find participants', error as Error);
    }
  }

  async findApprovedByRoomId(roomId: string): Promise<RoomParticipant[]> {
    const query = `
      SELECT * FROM room_participants
      WHERE room_id = $1 AND status = 'approved'
      ORDER BY created_at ASC
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows as RoomParticipant[];
    } catch (error) {
      logger.error('Failed to find approved participants', { error, room_id: roomId });
      throw new DatabaseError('Failed to find participants', error as Error);
    }
  }

  async findPendingByRoomId(roomId: string): Promise<RoomParticipant[]> {
    const query = `
      SELECT * FROM room_participants
      WHERE room_id = $1 AND status = 'pending'
      ORDER BY created_at ASC
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows as RoomParticipant[];
    } catch (error) {
      logger.error('Failed to find pending participants', { error, room_id: roomId });
      throw new DatabaseError('Failed to find participants', error as Error);
    }
  }

  async findByAnonymousId(roomId: string, anonymousId: string): Promise<RoomParticipant | null> {
    const query = `
      SELECT * FROM room_participants
      WHERE room_id = $1 AND anonymous_id = $2
    `;

    try {
      const result = await this.db.query(query, [roomId, anonymousId]);
      return (result.rows[0] as RoomParticipant) || null;
    } catch (error) {
      logger.error('Failed to find participant by anonymous_id', { error, room_id: roomId });
      throw new DatabaseError('Failed to find participant', error as Error);
    }
  }

  async approve(participantId: string, wrappedGroupKey: string): Promise<RoomParticipant> {
    const query = `
      UPDATE room_participants
      SET status = 'approved', wrapped_group_key = $2, joined_at = CURRENT_TIMESTAMP
      WHERE participant_id = $1 AND status = 'pending'
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [participantId, wrappedGroupKey]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Participant');
      }
      return result.rows[0] as RoomParticipant;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to approve participant', { error, participant_id: participantId });
      throw new DatabaseError('Failed to approve participant', error as Error);
    }
  }

  async reject(participantId: string): Promise<RoomParticipant> {
    const query = `
      UPDATE room_participants
      SET status = 'rejected'
      WHERE participant_id = $1 AND status = 'pending'
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [participantId]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Participant');
      }
      return result.rows[0] as RoomParticipant;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to reject participant', { error, participant_id: participantId });
      throw new DatabaseError('Failed to reject participant', error as Error);
    }
  }

  async countApprovedByRoomId(roomId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM room_participants
      WHERE room_id = $1 AND status = 'approved'
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count approved participants', { error, room_id: roomId });
      throw new DatabaseError('Failed to count participants', error as Error);
    }
  }

  async getCreator(roomId: string): Promise<RoomParticipant | null> {
    const query = `
      SELECT * FROM room_participants
      WHERE room_id = $1 AND is_creator = TRUE
      LIMIT 1
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return (result.rows[0] as RoomParticipant) || null;
    } catch (error) {
      logger.error('Failed to find room creator', { error, room_id: roomId });
      throw new DatabaseError('Failed to find creator', error as Error);
    }
  }

  /**
   * Find approved participants who still need their group key wrapped
   * Used for auto-approve rooms where creator must distribute keys client-side
   */
  async findApprovedNeedingKeys(roomId: string): Promise<RoomParticipant[]> {
    const query = `
      SELECT * FROM room_participants
      WHERE room_id = $1
        AND status = 'approved'
        AND wrapped_group_key IS NULL
        AND is_creator = FALSE
      ORDER BY created_at ASC
    `;

    try {
      const result = await this.db.query(query, [roomId]);
      return result.rows as RoomParticipant[];
    } catch (error) {
      logger.error('Failed to find participants needing keys', { error, room_id: roomId });
      throw new DatabaseError('Failed to find participants', error as Error);
    }
  }

  /**
   * Set wrapped group key for an approved participant
   * Used after creator wraps the key client-side
   */
  async setWrappedKey(participantId: string, wrappedGroupKey: string): Promise<RoomParticipant> {
    const query = `
      UPDATE room_participants
      SET wrapped_group_key = $2, joined_at = COALESCE(joined_at, CURRENT_TIMESTAMP)
      WHERE participant_id = $1 AND status = 'approved'
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [participantId, wrappedGroupKey]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Participant');
      }
      return result.rows[0] as RoomParticipant;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to set wrapped key', { error, participant_id: participantId });
      throw new DatabaseError('Failed to set wrapped key', error as Error);
    }
  }
}
