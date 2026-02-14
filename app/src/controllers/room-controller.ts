/**
 * Room Controller
 * Handles authenticated room management operations
 */

import { Request, Response, NextFunction } from 'express';
import { RoomService, CreateRoomInput } from '../services/room-service';
import { RoomInviteService, GenerateInvitesInput } from '../services/room-invite-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';

const roomService = new RoomService();
const inviteService = new RoomInviteService();

/**
 * Create new room
 * POST /api/v1/dashboard/rooms
 */
export const createRoom = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('create_room');

    try {
      const userId = req.user!.sub;
      const email = req.user!.email;
      const input = req.validated as CreateRoomInput;

      const room = await roomService.createRoom(userId, input, email);

      subsegment?.close();

      ResponseUtils.success(
        res,
        {
          room_id: room.room_id,
          display_name: room.display_name,
          description: room.description,
          expires_at: room.expires_at,
          join_window_minutes: room.join_window_minutes,
          max_participants: room.max_participants,
          participant_count: room.participant_count,
          auto_approve: room.auto_approve,
          burned: room.burned,
          created_at: room.created_at,
          creator_participant_id: room.participants[0].participant_id,
          creator_anonymous_id: room.participants[0].anonymous_id,
        },
        201
      );
    } catch (error) {
      subsegment?.addError(error as Error);
      subsegment?.close();
      throw error;
    }
  }
);

/**
 * Get all rooms for authenticated user
 * GET /api/v1/dashboard/rooms
 */
export const getUserRooms = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await roomService.getUserRooms(userId, pageNum, limitNum);
    const totalPages = Math.ceil(result.total / limitNum);

    ResponseUtils.paginated(res, result.rooms, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
      total_pages: totalPages,
    });
  }
);

/**
 * Get room by ID with participants
 * GET /api/v1/dashboard/rooms/:room_id
 */
export const getRoomById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;

    const room = await roomService.getRoomById(room_id, userId);

    ResponseUtils.success(res, room);
  }
);

/**
 * Lock room (close to new participants)
 * POST /api/v1/dashboard/rooms/:room_id/lock
 */
export const lockRoom = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;

    const room = await roomService.lockRoom(room_id, userId);

    ResponseUtils.success(res, { room_id: room.room_id, locked_at: room.locked_at });
  }
);

/**
 * Burn room (delete all data)
 * POST /api/v1/dashboard/rooms/:room_id/burn
 */
export const burnRoom = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;

    await roomService.burnRoom(room_id, userId);

    res.status(204).send();
  }
);

/**
 * Generate invite tokens
 * POST /api/v1/dashboard/rooms/:room_id/invites
 */
export const generateInvites = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;
    const input = req.validated as GenerateInvitesInput;

    const invites = await inviteService.generateInvites(room_id, userId, input);

    ResponseUtils.success(res, { invites }, 201);
  }
);

/**
 * Get all invites for a room
 * GET /api/v1/dashboard/rooms/:room_id/invites
 */
export const getInvites = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;

    const invites = await inviteService.getInvites(room_id, userId);

    // Don't expose token hashes, only metadata
    const sanitized = invites.map((inv) => ({
      invite_id: inv.invite_id,
      label: inv.label,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      redeemed: !!inv.redeemed_at,
      revoked: inv.revoked,
    }));

    ResponseUtils.success(res, { invites: sanitized });
  }
);

/**
 * Revoke an invite
 * DELETE /api/v1/dashboard/rooms/:room_id/invites/:invite_id
 */
export const revokeInvite = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id, invite_id } = req.params as Record<string, string>;

    await inviteService.revokeInvite(room_id, invite_id, userId);

    res.status(204).send();
  }
);

/**
 * Get pending participants
 * GET /api/v1/dashboard/rooms/:room_id/pending
 */
export const getPendingParticipants = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;

    const pending = await roomService.getPendingParticipants(room_id, userId);

    const sanitized = pending.map((p) => ({
      participant_id: p.participant_id,
      anonymous_id: p.anonymous_id,
      display_name: p.display_name,
      public_key: p.public_key,
      created_at: p.created_at,
    }));

    ResponseUtils.success(res, { pending: sanitized });
  }
);

/**
 * Approve participant
 * POST /api/v1/dashboard/rooms/:room_id/participants/:participant_id/approve
 */
export const approveParticipant = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id, participant_id } = req.params as Record<string, string>;
    const { wrapped_group_key } = req.validated as { wrapped_group_key: string };

    const participant = await roomService.approveParticipant(
      room_id,
      participant_id,
      userId,
      wrapped_group_key
    );

    ResponseUtils.success(res, {
      participant_id: participant.participant_id,
      status: participant.status,
      joined_at: participant.joined_at,
    });
  }
);

/**
 * Reject participant
 * POST /api/v1/dashboard/rooms/:room_id/participants/:participant_id/reject
 */
export const rejectParticipant = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id, participant_id } = req.params as Record<string, string>;

    const participant = await roomService.rejectParticipant(room_id, participant_id, userId);

    ResponseUtils.success(res, {
      participant_id: participant.participant_id,
      status: participant.status,
    });
  }
);

/**
 * Get participants needing keys (for auto-approve key distribution)
 * GET /api/v1/dashboard/rooms/:room_id/needs-keys
 */
export const getParticipantsNeedingKeys = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id } = req.params as Record<string, string>;

    const participants = await roomService.getParticipantsNeedingKeys(room_id, userId);

    const sanitized = participants.map((p) => ({
      participant_id: p.participant_id,
      anonymous_id: p.anonymous_id,
      display_name: p.display_name,
      public_key: p.public_key,
      created_at: p.created_at,
    }));

    ResponseUtils.success(res, { participants: sanitized });
  }
);

/**
 * Set wrapped key for a participant (for auto-approve key distribution)
 * POST /api/v1/dashboard/rooms/:room_id/participants/:participant_id/set-key
 */
export const setParticipantKey = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { room_id, participant_id } = req.params as Record<string, string>;
    const { wrapped_group_key } = req.validated as { wrapped_group_key: string };

    const participant = await roomService.setParticipantWrappedKey(
      room_id,
      participant_id,
      userId,
      wrapped_group_key
    );

    ResponseUtils.success(res, {
      participant_id: participant.participant_id,
      status: participant.status,
      joined_at: participant.joined_at,
    });
  }
);
