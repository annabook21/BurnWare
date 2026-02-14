/**
 * Broadcast Validators
 * Joi schemas for broadcast channel and post validation
 */

import Joi from 'joi';

export const createBroadcastChannelSchema = Joi.object({
  display_name: Joi.string().min(1).max(100).required().trim(),
  expires_at: Joi.date().iso().optional().allow(null),
});

export const channelIdSchema = Joi.object({
  channel_id: Joi.string().min(1).max(16).pattern(/^[A-Za-z0-9_-]+$/).required(),
});

export const addPostSchema = Joi.object({
  post_token: Joi.string().min(1).max(256).required(),
  content: Joi.string().min(1).max(10000).required().trim(),
});

export const burnChannelSchema = Joi.object({
  post_token: Joi.string().min(1).max(256).required(),
});

export const listPostsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().default(50),
  before: Joi.string().uuid().optional(),
});
