/**
 * Room Routes
 * Routes for secure chat rooms (both authenticated and public)
 */

import { Router } from 'express';
import {
  createRoom,
  getUserRooms,
  getRoomById,
  lockRoom,
  burnRoom,
  generateInvites,
  getInvites,
  revokeInvite,
  getPendingParticipants,
  approveParticipant,
  rejectParticipant,
  getParticipantsNeedingKeys,
  setParticipantKey,
} from '../controllers/room-controller';
import {
  joinRoom,
  getParticipantStatus,
  getRoomInfo,
  getMessages,
  sendMessage,
} from '../controllers/room-join-controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation-middleware';
import {
  createRoomSchema,
  roomIdSchema,
  participantIdSchema,
  inviteIdSchema,
  generateInvitesSchema,
  approveParticipantSchema,
  joinRoomSchema,
  roomStatusQuerySchema,
  sendRoomMessageSchema,
  getRoomMessagesQuerySchema,
} from '../validators/room-validators';
import { paginationSchema } from '../validators/link-validators';
import {
  authenticatedRateLimiter,
  strictRateLimiter,
} from '../middleware/rate-limit-middleware';
import { roomJoinRateLimiter, roomMessageRateLimiter, roomStatusRateLimiter, roomMessagesRateLimiter } from './room-rate-limiters';

// Authenticated dashboard routes
export const dashboardRoomRoutes = Router();

dashboardRoomRoutes.use(authenticateJWT);
dashboardRoomRoutes.use(authenticatedRateLimiter);

// Room CRUD
dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms',
  strictRateLimiter,
  validateBody(createRoomSchema),
  createRoom
);

dashboardRoomRoutes.get(
  '/api/v1/dashboard/rooms',
  validateQuery(paginationSchema),
  getUserRooms
);

dashboardRoomRoutes.get(
  '/api/v1/dashboard/rooms/:room_id',
  validateParams(roomIdSchema),
  getRoomById
);

dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms/:room_id/lock',
  validateParams(roomIdSchema),
  lockRoom
);

dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms/:room_id/burn',
  validateParams(roomIdSchema),
  burnRoom
);

// Invites
dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms/:room_id/invites',
  validateParams(roomIdSchema),
  validateBody(generateInvitesSchema),
  generateInvites
);

dashboardRoomRoutes.get(
  '/api/v1/dashboard/rooms/:room_id/invites',
  validateParams(roomIdSchema),
  getInvites
);

dashboardRoomRoutes.delete(
  '/api/v1/dashboard/rooms/:room_id/invites/:invite_id',
  validateParams(inviteIdSchema),
  revokeInvite
);

// Participant management
dashboardRoomRoutes.get(
  '/api/v1/dashboard/rooms/:room_id/pending',
  validateParams(roomIdSchema),
  getPendingParticipants
);

dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms/:room_id/participants/:participant_id/approve',
  validateParams(participantIdSchema),
  validateBody(approveParticipantSchema),
  approveParticipant
);

dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms/:room_id/participants/:participant_id/reject',
  validateParams(participantIdSchema),
  rejectParticipant
);

// Auto-approve key distribution
dashboardRoomRoutes.get(
  '/api/v1/dashboard/rooms/:room_id/needs-keys',
  validateParams(roomIdSchema),
  getParticipantsNeedingKeys
);

dashboardRoomRoutes.post(
  '/api/v1/dashboard/rooms/:room_id/participants/:participant_id/set-key',
  validateParams(participantIdSchema),
  validateBody(approveParticipantSchema),
  setParticipantKey
);

// Public routes (anonymous)
export const publicRoomRoutes = Router();

// Join room via invite token
publicRoomRoutes.post(
  '/api/v1/rooms/join',
  roomJoinRateLimiter,
  validateBody(joinRoomSchema),
  joinRoom
);

// Check approval status
publicRoomRoutes.get(
  '/api/v1/rooms/:room_id/status',
  roomStatusRateLimiter,
  validateParams(roomIdSchema),
  validateQuery(roomStatusQuerySchema),
  getParticipantStatus
);

// Get room info (public, minimal)
publicRoomRoutes.get(
  '/api/v1/rooms/:room_id/info',
  validateParams(roomIdSchema),
  getRoomInfo
);

// Get messages (for approved participants)
publicRoomRoutes.get(
  '/api/v1/rooms/:room_id/messages',
  roomMessagesRateLimiter,
  validateParams(roomIdSchema),
  validateQuery(getRoomMessagesQuerySchema),
  getMessages
);

// Send message (for approved participants)
publicRoomRoutes.post(
  '/api/v1/rooms/:room_id/messages',
  roomMessageRateLimiter,
  validateParams(roomIdSchema),
  validateBody(sendRoomMessageSchema),
  sendMessage
);
