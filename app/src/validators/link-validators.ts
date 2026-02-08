/**
 * Link Validators
 * Joi schemas for link validation
 * File size: ~85 lines
 */

import Joi from 'joi';

/**
 * Schema for creating a new link
 */
export const createLinkSchema = Joi.object({
  display_name: Joi.string().min(1).max(100).required().trim(),
  description: Joi.string().max(500).optional().allow('').trim(),
  expires_in_days: Joi.number().integer().min(1).max(365).optional(),
});

/**
 * Schema for updating a link
 */
export const updateLinkSchema = Joi.object({
  display_name: Joi.string().min(1).max(100).optional().trim(),
  description: Joi.string().max(500).optional().allow('').trim(),
  expires_in_days: Joi.number().integer().min(1).max(365).optional(),
}).min(1); // At least one field required

/**
 * Schema for link ID parameter
 */
export const linkIdSchema = Joi.object({
  link_id: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).min(8).max(16).required(),
});

/**
 * Schema for pagination query
 */
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
