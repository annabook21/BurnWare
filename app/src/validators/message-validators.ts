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
  recipient_link_id: Joi.string().alphanum().min(8).max(16).required(),
  message: Joi.string().min(1).max(5000).required().trim(),
  captcha_token: Joi.string().optional(), // WAF CAPTCHA token
});

/**
 * Schema for owner reply to thread
 */
export const replyMessageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required().trim(),
});

/**
 * Schema for message query filters
 */
export const messageQuerySchema = Joi.object({
  thread_id: Joi.string().uuid().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
