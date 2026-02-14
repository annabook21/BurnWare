/**
 * Room Invite Service
 * Business logic for room invite token management
 */

import crypto from 'crypto';
import { RoomModel } from '../models/room-model';
import { RoomInviteModel, RoomInvite, CreateInviteData } from '../models/room-invite-model';
import { RoomParticipantModel, CreateParticipantData, RoomParticipant } from '../models/room-participant-model';
import { CryptoUtils } from '../utils/crypto-utils';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { AppSyncPublisher } from './appsync-publisher';

const MAX_INVITES_PER_ROOM = 20;
const INVITE_TOKEN_LENGTH = 32; // 256 bits

export interface GenerateInvitesInput {
  count: number;
  labels?: string[];
}

export interface GeneratedInvite {
  invite_id: string;
  token: string; // Plaintext token (only returned once)
  label?: string;
  expires_at: Date;
}

export interface JoinRoomInput {
  invite_token: string;
  public_key: string;
  display_name?: string;
}

export interface JoinResult {
  participant_id: string;
  anonymous_id: string;
  room_id: string;
  status: 'pending' | 'approved';
  wrapped_group_key?: string;
  watermark_seed: string;
  room_public_key: string;
  participants: Array<{
    anonymous_id: string;
    display_name?: string;
    public_key: string;
  }>;
}

export class RoomInviteService {
  private roomModel: RoomModel;
  private inviteModel: RoomInviteModel;
  private participantModel: RoomParticipantModel;
  private publisher: AppSyncPublisher;

  constructor() {
    this.roomModel = new RoomModel();
    this.inviteModel = new RoomInviteModel();
    this.participantModel = new RoomParticipantModel();
    this.publisher = new AppSyncPublisher();
  }

  async generateInvites(
    roomId: string,
    userId: string,
    input: GenerateInvitesInput
  ): Promise<GeneratedInvite[]> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to generate invites');
    }

    if (room.burned) {
      throw new ValidationError('Room has been burned');
    }

    // Check room isn't locked
    const isLocked = await this.roomModel.isLocked(roomId);
    if (isLocked) {
      throw new ValidationError('Room is locked, no new invites allowed');
    }

    // Check invite limit
    const existingCount = await this.inviteModel.countByRoomId(roomId);
    if (existingCount + input.count > MAX_INVITES_PER_ROOM) {
      throw new ValidationError(`Maximum ${MAX_INVITES_PER_ROOM} invites per room`);
    }

    // Calculate invite expiration (same as room lock time)
    const expiresAt = new Date(room.created_at);
    expiresAt.setMinutes(expiresAt.getMinutes() + room.join_window_minutes);

    // Generate tokens and hashes
    const invitesToCreate: CreateInviteData[] = [];
    const generatedTokens: { token: string; label?: string }[] = [];

    for (let i = 0; i < input.count; i++) {
      const token = crypto.randomBytes(INVITE_TOKEN_LENGTH).toString('base64url');
      const tokenHash = CryptoUtils.hash(token);
      const label = input.labels?.[i];

      invitesToCreate.push({
        room_id: roomId,
        invite_token_hash: tokenHash,
        label,
        expires_at: expiresAt,
      });

      generatedTokens.push({ token, label });
    }

    // Create all invites
    const createdInvites = await this.inviteModel.createMany(invitesToCreate);

    // Map back to include plaintext tokens
    const result: GeneratedInvite[] = createdInvites.map((invite, index) => ({
      invite_id: invite.invite_id,
      token: generatedTokens[index].token,
      label: invite.label,
      expires_at: invite.expires_at,
    }));

    LoggerUtils.logMetric('room_invites_generated', input.count, 'count');

    return result;
  }

  async joinRoom(input: JoinRoomInput): Promise<JoinResult> {
    // Hash the provided token for lookup
    const tokenHash = CryptoUtils.hash(input.invite_token);

    // Find valid invite (timing-safe: always do the lookup)
    const invite = await this.inviteModel.findValidByTokenHash(tokenHash);

    // Generic error for security (don't reveal if token exists but is expired/redeemed)
    if (!invite) {
      throw new NotFoundError('Room');
    }

    // Get room
    const room = await this.roomModel.findActiveById(invite.room_id);
    if (!room) {
      throw new NotFoundError('Room');
    }

    // Check room isn't locked
    const isLocked = await this.roomModel.isLocked(invite.room_id);
    if (isLocked) {
      throw new ValidationError('Room is no longer accepting new participants');
    }

    // Check room isn't full
    const isFull = await this.roomModel.isFull(invite.room_id);
    if (isFull) {
      throw new ValidationError('Room is at maximum capacity');
    }

    // Create participant first, then redeem invite so a failed create doesn't burn the one-time token
    const anonymousId = CryptoUtils.generateRandomString(16);
    const watermarkSeed = CryptoUtils.generateRandomString(32);

    const participantData: CreateParticipantData = {
      room_id: room.room_id,
      invite_id: invite.invite_id,
      anonymous_id: anonymousId,
      display_name: input.display_name,
      public_key: input.public_key,
      watermark_seed: watermarkSeed,
      status: room.auto_approve ? 'approved' : 'pending',
      is_creator: false,
    };

    const participant = await this.participantModel.create(participantData);

    await this.inviteModel.redeem(invite.invite_id);

    // Get approved participants for key exchange
    const approvedParticipants = await this.participantModel.findApprovedByRoomId(room.room_id);

    LoggerUtils.logMetric('room_join_attempt', 1, 'count');

    logger.info('Participant joined room', {
      room_id: room.room_id,
      participant_id: participant.participant_id,
      status: participant.status,
    });

    // Fire-and-forget: notify creator if auto-approved participant needs key wrapping
    if (room.auto_approve && participant.status === 'approved' && !participant.wrapped_group_key) {
      void this.publisher.publishRoomKeyNeeded(
        room.room_id,
        participant.participant_id,
        participant.anonymous_id,
        participant.public_key,
        participant.display_name
      );
    }

    return {
      participant_id: participant.participant_id,
      anonymous_id: participant.anonymous_id,
      room_id: room.room_id,
      status: participant.status as 'pending' | 'approved',
      wrapped_group_key: participant.wrapped_group_key || undefined,
      watermark_seed: participant.watermark_seed,
      room_public_key: room.group_public_key,
      participants: approvedParticipants.map((p) => ({
        anonymous_id: p.anonymous_id,
        display_name: p.display_name,
        public_key: p.public_key,
      })),
    };
  }

  async getParticipantStatus(
    roomId: string,
    anonymousId: string
  ): Promise<{
    status: 'pending' | 'approved' | 'rejected';
    wrapped_group_key?: string;
    participants?: Array<{
      anonymous_id: string;
      display_name?: string;
      public_key: string;
    }>;
  }> {
    const room = await this.roomModel.findById(roomId);
    if (!room || room.burned) {
      throw new NotFoundError('Room');
    }

    const participant = await this.participantModel.findByAnonymousId(roomId, anonymousId);
    if (!participant) {
      throw new NotFoundError('Room');
    }

    const result: {
      status: 'pending' | 'approved' | 'rejected';
      wrapped_group_key?: string;
      participants?: Array<{
        anonymous_id: string;
        display_name?: string;
        public_key: string;
      }>;
    } = {
      status: participant.status as 'pending' | 'approved' | 'rejected',
    };

    if (participant.status === 'approved') {
      result.wrapped_group_key = participant.wrapped_group_key || undefined;

      // Include other approved participants for UI
      const approvedParticipants = await this.participantModel.findApprovedByRoomId(roomId);
      result.participants = approvedParticipants.map((p) => ({
        anonymous_id: p.anonymous_id,
        display_name: p.display_name,
        public_key: p.public_key,
      }));
    }

    return result;
  }

  async getInvites(roomId: string, userId: string): Promise<RoomInvite[]> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to view invites');
    }

    return this.inviteModel.findByRoomId(roomId);
  }

  async revokeInvite(roomId: string, inviteId: string, userId: string): Promise<void> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.creator_user_id !== userId) {
      throw new AuthorizationError('Not authorized to revoke invites');
    }

    const updated = await this.inviteModel.revokeForRoom(roomId, inviteId);
    if (updated === 0) {
      throw new NotFoundError('Invite');
    }

    logger.info('Invite revoked', { room_id: roomId, invite_id: inviteId });
  }
}
