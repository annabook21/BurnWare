/**
 * Room Service
 * Business logic for secure chat room management
 */

import { RoomModel, Room, CreateRoomData } from '../models/room-model';
import { RoomParticipantModel, CreateParticipantData, RoomParticipant } from '../models/room-participant-model';
import { RoomMessageModel, CreateRoomMessageData, RoomMessageWithSender } from '../models/room-message-model';
import { CryptoUtils } from '../utils/crypto-utils';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { getDb } from '../config/database';
import { AppSyncPublisher } from './appsync-publisher';

const MAX_ROOMS_PER_USER = 10;
const ROOM_LIFESPAN_HOURS = 24;

export interface CreateRoomInput {
  display_name: string;
  description?: string;
  join_window_minutes?: number;
  max_participants?: number;
  auto_approve?: boolean;
  group_public_key: string;
  creator_public_key: string;
  creator_wrapped_group_key: string;
}

export interface RoomWithParticipants extends Room {
  participants: RoomParticipant[];
}

export class RoomService {
  private roomModel: RoomModel;
  private participantModel: RoomParticipantModel;
  private messageModel: RoomMessageModel;
  private publisher: AppSyncPublisher;

  constructor() {
    this.roomModel = new RoomModel();
    this.participantModel = new RoomParticipantModel();
    this.messageModel = new RoomMessageModel();
    this.publisher = new AppSyncPublisher();
  }

  /**
   * Ensure user exists in users table (upsert)
   */
  private async ensureUserExists(userId: string, email?: string): Promise<void> {
    const db = getDb();
    await db.query(
      `INSERT INTO users (user_id, email, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         updated_at = CURRENT_TIMESTAMP,
         last_login_at = CURRENT_TIMESTAMP`,
      [userId, email || `${userId}@unknown.local`]
    );
  }

  async createRoom(userId: string, input: CreateRoomInput, email?: string): Promise<RoomWithParticipants> {
    // Ensure user exists in users table (FK constraint)
    await this.ensureUserExists(userId, email);

    // Check user hasn't exceeded max rooms
    const userRoomCount = await this.roomModel.countByUserId(userId);
    if (userRoomCount >= MAX_ROOMS_PER_USER) {
      throw new ValidationError(`Maximum ${MAX_ROOMS_PER_USER} active rooms per user`);
    }

    // Calculate expiration (24h from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ROOM_LIFESPAN_HOURS);

    // Create room
    const roomData: CreateRoomData = {
      creator_user_id: userId,
      display_name: input.display_name,
      description: input.description,
      expires_at: expiresAt,
      join_window_minutes: input.join_window_minutes,
      max_participants: input.max_participants,
      auto_approve: input.auto_approve,
      group_public_key: input.group_public_key,
    };

    const room = await this.roomModel.create(roomData);

    // Create creator as first participant
    const creatorParticipant: CreateParticipantData = {
      room_id: room.room_id,
      anonymous_id: CryptoUtils.generateRandomString(16),
      display_name: 'Creator',
      public_key: input.creator_public_key,
      wrapped_group_key: input.creator_wrapped_group_key,
      watermark_seed: CryptoUtils.generateRandomString(32),
      is_creator: true,
      status: 'approved',
    };

    const creator = await this.participantModel.create(creatorParticipant);

    LoggerUtils.logMetric('room_created', 1, 'count');

    return {
      ...room,
      participants: [creator],
    };
  }

  async getRoomById(roomId: string, userId: string): Promise<RoomWithParticipants> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to view this room');
    }

    const participants = await this.participantModel.findByRoomId(roomId);

    return { ...room, participants };
  }

  async getUserRooms(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ rooms: Room[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const rooms = await this.roomModel.findByUserId(userId, limit, offset);
    const total = await this.roomModel.countByUserId(userId);

    return { rooms, total, page, limit };
  }

  async lockRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to lock this room');
    }

    if (room.locked_at) {
      throw new ValidationError('Room is already locked');
    }

    const lockedRoom = await this.roomModel.lock(roomId);
    LoggerUtils.logMetric('room_locked', 1, 'count');

    return lockedRoom;
  }

  async burnRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to burn this room');
    }

    if (room.burned) {
      logger.info('Room already burned', { room_id: roomId });
      return;
    }

    await this.roomModel.burn(roomId);

    LoggerUtils.logMetric('room_burned', 1, 'count');
    LoggerUtils.logSecurityEvent('room_burned', { room_id: roomId, user_id: userId });

    logger.info('Room burned successfully', { room_id: roomId, user_id: userId });
  }

  async getPendingParticipants(roomId: string, userId: string): Promise<RoomParticipant[]> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to view pending participants');
    }

    return this.participantModel.findPendingByRoomId(roomId);
  }

  /**
   * Get approved participants who still need their group key wrapped
   * Used for auto-approve rooms where client-side key wrapping is needed
   */
  async getParticipantsNeedingKeys(roomId: string, userId: string): Promise<RoomParticipant[]> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized');
    }

    return this.participantModel.findApprovedNeedingKeys(roomId);
  }

  /**
   * Set wrapped group key for an approved participant (for auto-approve key distribution)
   */
  async setParticipantWrappedKey(
    roomId: string,
    participantId: string,
    userId: string,
    wrappedGroupKey: string
  ): Promise<RoomParticipant> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized');
    }

    const participant = await this.participantModel.findById(participantId);
    if (!participant || participant.room_id !== roomId) {
      throw new NotFoundError('Participant');
    }

    if (participant.status !== 'approved') {
      throw new ValidationError('Participant is not approved');
    }

    if (participant.wrapped_group_key) {
      throw new ValidationError('Participant already has a wrapped key');
    }

    const updated = await this.participantModel.setWrappedKey(participantId, wrappedGroupKey);

    // Fire-and-forget: notify participant that their key is ready
    void this.publisher.publishKeyDistributed(
      roomId,
      participantId,
      participant.anonymous_id
    );

    return updated;
  }

  async approveParticipant(
    roomId: string,
    participantId: string,
    userId: string,
    wrappedGroupKey: string
  ): Promise<RoomParticipant> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to approve participants');
    }

    const participant = await this.participantModel.findById(participantId);
    if (!participant || participant.room_id !== roomId) {
      throw new NotFoundError('Participant');
    }

    if (participant.status !== 'pending') {
      throw new ValidationError('Participant is not pending approval');
    }

    // Check room capacity
    const isFull = await this.roomModel.isFull(roomId);
    if (isFull) {
      throw new ValidationError('Room is at maximum capacity');
    }

    const approved = await this.participantModel.approve(participantId, wrappedGroupKey);
    LoggerUtils.logMetric('participant_approved', 1, 'count');

    return approved;
  }

  async rejectParticipant(
    roomId: string,
    participantId: string,
    userId: string
  ): Promise<RoomParticipant> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to reject participants');
    }

    const participant = await this.participantModel.findById(participantId);
    if (!participant || participant.room_id !== roomId) {
      throw new NotFoundError('Participant');
    }

    if (participant.status !== 'pending') {
      throw new ValidationError('Participant is not pending');
    }

    return this.participantModel.reject(participantId);
  }

  async sendMessage(
    roomId: string,
    anonymousId: string,
    data: { ciphertext: string; nonce: string }
  ): Promise<RoomMessageWithSender> {
    const room = await this.roomModel.findActiveById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    // Find participant by anonymous_id
    const participant = await this.participantModel.findByAnonymousId(roomId, anonymousId);
    if (!participant) {
      throw new AuthorizationError('Not a participant of this room');
    }

    if (participant.status !== 'approved') {
      throw new AuthorizationError('Not approved to send messages');
    }

    const messageData: CreateRoomMessageData = {
      room_id: roomId,
      participant_id: participant.participant_id,
      ciphertext: data.ciphertext,
      nonce: data.nonce,
    };

    const message = await this.messageModel.create(messageData);

    // Fire-and-forget: notify room participants of new message
    void this.publisher.publishRoomMessage(
      roomId,
      message.message_id,
      participant.anonymous_id
    );

    return {
      ...message,
      anonymous_id: participant.anonymous_id,
      display_name: participant.display_name,
    };
  }

  async getMessages(
    roomId: string,
    anonymousId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: RoomMessageWithSender[]; total: number }> {
    const room = await this.roomModel.findActiveById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    // Verify participant
    const participant = await this.participantModel.findByAnonymousId(roomId, anonymousId);
    if (!participant || participant.status !== 'approved') {
      throw new AuthorizationError('Not authorized to view messages');
    }

    const offset = (page - 1) * limit;
    const messages = await this.messageModel.findByRoomId(roomId, limit, offset);
    const total = await this.messageModel.countByRoomId(roomId);

    return { messages, total };
  }

  async getMessagesSince(
    roomId: string,
    anonymousId: string,
    since: Date
  ): Promise<RoomMessageWithSender[]> {
    const room = await this.roomModel.findActiveById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    // Verify participant
    const participant = await this.participantModel.findByAnonymousId(roomId, anonymousId);
    if (!participant || participant.status !== 'approved') {
      throw new AuthorizationError('Not authorized to view messages');
    }

    return this.messageModel.findSinceTimestamp(roomId, since);
  }

  /**
   * Get messages after a cursor (timestamp + message_id)
   * Proper cursor-based pagination to avoid duplicates
   */
  async getMessagesAfterCursor(
    roomId: string,
    anonymousId: string,
    cursorTime: Date,
    cursorMessageId: string
  ): Promise<RoomMessageWithSender[]> {
    const room = await this.roomModel.findActiveById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    // Verify participant
    const participant = await this.participantModel.findByAnonymousId(roomId, anonymousId);
    if (!participant || participant.status !== 'approved') {
      throw new AuthorizationError('Not authorized to view messages');
    }

    return this.messageModel.findAfterCursor(roomId, cursorTime, cursorMessageId);
  }

  async getRoomStatus(roomId: string): Promise<{
    room_id: string;
    locked: boolean;
    expired: boolean;
    participant_count: number;
    max_participants: number;
  }> {
    const room = await this.roomModel.findById(roomId);
    if (!room || room.burned) {
      throw new NotFoundError('Room');
    }

    const isLocked = await this.roomModel.isLocked(roomId);
    const isExpired = new Date() > room.expires_at;

    return {
      room_id: room.room_id,
      locked: isLocked,
      expired: isExpired,
      participant_count: room.participant_count,
      max_participants: room.max_participants,
    };
  }
}
