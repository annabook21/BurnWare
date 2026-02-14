/**
 * Room Validators
 * Joi schemas for room validation
 */

import Joi from 'joi';

export const createRoomSchema = Joi.object({
  display_name: Joi.string().min(1).max(100).required().trim(),
  description: Joi.string().max(500).optional().allow('').trim(),
  join_window_minutes: Joi.number().integer().min(5).max(60).optional().default(15),
  max_participants: Joi.number().integer().min(2).max(10).optional().default(10),
  auto_approve: Joi.boolean().optional().default(false),
  group_public_key: Joi.string().min(1).max(500).required(),
  creator_public_key: Joi.string().min(1).max(500).required(),
  creator_wrapped_group_key: Joi.string().min(1).max(4096).required(),
});

export const roomIdSchema = Joi.object({
  room_id: Joi.string().uuid().required(),
});

export const participantIdSchema = Joi.object({
  room_id: Joi.string().uuid().required(),
  participant_id: Joi.string().uuid().required(),
});

export const inviteIdSchema = Joi.object({
  room_id: Joi.string().uuid().required(),
  invite_id: Joi.string().uuid().required(),
});

export const generateInvitesSchema = Joi.object({
  count: Joi.number().integer().min(1).max(10).required(),
  labels: Joi.array().items(Joi.string().max(50)).optional(),
});

export const approveParticipantSchema = Joi.object({
  wrapped_group_key: Joi.string().min(1).max(4096).required(),
});

export const joinRoomSchema = Joi.object({
  invite_token: Joi.string().min(1).max(128).required(),
  public_key: Joi.string().min(1).max(500).required(),
  display_name: Joi.string().max(50).optional().allow('').trim(),
});

export const roomStatusQuerySchema = Joi.object({
  anonymous_id: Joi.string().min(8).max(64).required(),
});

export const sendRoomMessageSchema = Joi.object({
  anonymous_id: Joi.string().min(8).max(64).required(),
  ciphertext: Joi.string().min(1).max(20000).required(),
  nonce: Joi.string().min(24).max(32).required(),
});

export const getRoomMessagesQuerySchema = Joi.object({
  anonymous_id: Joi.string().min(8).max(64).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  since: Joi.date().iso().optional(),
  cursor: Joi.string().max(80).optional(), // timestamp_messageId for cursor-based pagination
});
