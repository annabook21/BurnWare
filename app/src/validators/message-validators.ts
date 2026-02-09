/**
 * Message Validators
 * Joi schemas for message validation
 * File size: ~85 lines
 */

import Joi from 'joi';

/**
 * Schema for sending anonymous message
 */
export const sendMessageSchema = Joi.object({
  recipient_link_id: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).min(8).max(16).required(),
  // E2EE: ciphertext + sender_public_key (new links with public_key)
  ciphertext: Joi.string().min(1).max(10000),
  sender_public_key: Joi.string().min(1).max(500),
  // Legacy plaintext (links without public_key)
  message: Joi.string().min(1).max(5000),
  captcha_token: Joi.string().optional(), // WAF CAPTCHA token
  passphrase: Joi.string().min(1).max(128), // OPSEC passphrase (required for passphrase-gated links)
}).or('ciphertext', 'message')
  .with('ciphertext', 'sender_public_key')
  .with('sender_public_key', 'ciphertext');

/**
 * Schema for owner reply to thread
 */
export const replyMessageSchema = Joi.object({
  ciphertext: Joi.string().min(1).max(10000),
  message: Joi.string().min(1).max(5000),
}).or('ciphertext', 'message');

/**
 * Schema for message query filters
 */
export const messageQuerySchema = Joi.object({
  thread_id: Joi.string().uuid().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
