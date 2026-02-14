/**
 * Room Join Controller
 * Handles public (anonymous) room join operations
 */

import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/room-service';
import { RoomInviteService, JoinRoomInput } from '../services/room-invite-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';

const roomService = new RoomService();
const inviteService = new RoomInviteService();

/**
 * Join room via invite token
 * POST /api/v1/rooms/join
 */
export const joinRoom = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const input = req.validated as JoinRoomInput;

    const result = await inviteService.joinRoom(input);

    ResponseUtils.success(
      res,
      {
        participant_id: result.participant_id,
        anonymous_id: result.anonymous_id,
        room_id: result.room_id,
        status: result.status,
        wrapped_group_key: result.wrapped_group_key,
        watermark_seed: result.watermark_seed,
        room_public_key: result.room_public_key,
        participants: result.participants,
      },
      201
    );
  }
);

/**
 * Check participant approval status
 * GET /api/v1/rooms/:room_id/status
 */
export const getParticipantStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { room_id } = req.params as Record<string, string>;
    const { anonymous_id } = req.query as { anonymous_id: string };

    const status = await inviteService.getParticipantStatus(room_id, anonymous_id);

    ResponseUtils.success(res, status);
  }
);

/**
 * Get room status (public, minimal info)
 * GET /api/v1/rooms/:room_id/info
 */
export const getRoomInfo = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { room_id } = req.params as Record<string, string>;

    const status = await roomService.getRoomStatus(room_id);

    ResponseUtils.success(res, status);
  }
);

/**
 * Get room messages (for approved participants)
 * GET /api/v1/rooms/:room_id/messages
 *
 * Supports cursor-based pagination:
 * - cursor: {timestamp}_{message_id} - returns messages after this cursor
 * - since: timestamp (deprecated) - returns messages after this timestamp
 */
export const getMessages = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { room_id } = req.params as Record<string, string>;
    const { anonymous_id, page, limit, cursor, since } = req.query as {
      anonymous_id: string;
      page?: string;
      limit?: string;
      cursor?: string;
      since?: string;
    };

    // Cursor-based pagination (preferred): cursor={timestamp}_{message_id}
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (cursor) {
      const [cursorTime, cursorMessageId] = cursor.split('_');
      const cursorDate = cursorTime ? new Date(cursorTime) : null;
      const validDate = cursorDate && !Number.isNaN(cursorDate.getTime());
      const validMessageId = cursorMessageId && uuidRegex.test(cursorMessageId);
      if (validDate && validMessageId && cursorDate) {
        const messages = await roomService.getMessagesAfterCursor(
          room_id,
          anonymous_id,
          cursorDate,
          cursorMessageId
        );
        ResponseUtils.success(res, { messages });
        return;
      }
      // Invalid cursor: fall back to first page instead of passing bad data to DB
    }

    // Legacy: timestamp-only polling (deprecated, can cause duplicates)
    if (since) {
      const sinceDate = new Date(since);
      const messages = await roomService.getMessagesSince(room_id, anonymous_id, sinceDate);
      ResponseUtils.success(res, { messages });
      return;
    }

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));

    const result = await roomService.getMessages(room_id, anonymous_id, pageNum, limitNum);
    const totalPages = Math.ceil(result.total / limitNum);

    ResponseUtils.paginated(res, result.messages, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
      total_pages: totalPages,
    });
  }
);

/**
 * Send message to room (for approved participants)
 * POST /api/v1/rooms/:room_id/messages
 */
export const sendMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { room_id } = req.params as Record<string, string>;
    const { anonymous_id, ciphertext, nonce } = req.validated as {
      anonymous_id: string;
      ciphertext: string;
      nonce: string;
    };

    const message = await roomService.sendMessage(room_id, anonymous_id, { ciphertext, nonce });

    ResponseUtils.success(
      res,
      {
        message_id: message.message_id,
        room_id: message.room_id,
        anonymous_id: message.anonymous_id,
        ciphertext: message.ciphertext,
        nonce: message.nonce,
        created_at: message.created_at,
      },
      201
    );
  }
);
