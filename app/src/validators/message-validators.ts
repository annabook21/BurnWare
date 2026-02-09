/**
 * Message Validators
 * Joi schemas for message validation
 * File size: ~85 lines
 */

import Joi from 'joi';

/**
 * Schema for sending anonymous message (E2EE only)
 */
export const sendMessageSchema = Joi.object({
  recipient_link_id: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).min(8).max(16).required(),
  ciphertext: Joi.string().min(1).max(10000).required(),
  sender_public_key: Joi.string().min(1).max(500).required(),
  captcha_token: Joi.string().optional(), // WAF CAPTCHA token
  passphrase: Joi.string().min(1).max(128), // OPSEC passphrase (required for passphrase-gated links)
});

/**
 * Schema for owner reply to thread (E2EE only)
 */
export const replyMessageSchema = Joi.object({
  ciphertext: Joi.string().min(1).max(10000).required(),
});

/**
 * Schema for message query filters
 */
export const messageQuerySchema = Joi.object({
  thread_id: Joi.string().uuid().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
