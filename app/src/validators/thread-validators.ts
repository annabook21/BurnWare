/**
 * Thread Validators
 * Joi schemas for thread validation
 * File size: ~75 lines
 */

import Joi from 'joi';

/**
 * Schema for thread ID parameter
 */
export const threadIdSchema = Joi.object({
  thread_id: Joi.string().uuid().required(),
});

/**
 * Schema for thread query filters
 */
export const threadQuerySchema = Joi.object({
  link_id: Joi.string().alphanum().min(8).max(16).optional(),
  burned: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Schema for burning a thread
 */
export const burnThreadSchema = Joi.object({
  confirm: Joi.boolean().valid(true).required(),
});

/**
 * Schema for unlocking a passphrase-protected thread
 */
export const unlockThreadSchema = Joi.object({
  passphrase: Joi.string().min(1).max(128).required(),
});
