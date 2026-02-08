/**
 * Dashboard Routes
 * Authenticated endpoints for link owners
 * File size: ~175 lines
 */

import { Router } from 'express';
import {
  createLink,
  getUserLinks,
  getMessageCounts,
  getLinkById,
  updateLink,
  deleteLink,
} from '../controllers/link-controller';
import {
  getLinkThreads,
  getThreadWithMessages,
  replyToThread,
} from '../controllers/thread-controller';
import { burnThread, burnLink } from '../controllers/burn-controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation-middleware';
import {
  createLinkSchema,
  updateLinkSchema,
  linkIdSchema,
  paginationSchema,
} from '../validators/link-validators';
import {
  threadIdSchema,
  threadQuerySchema,
  burnThreadSchema,
} from '../validators/thread-validators';
import { replyMessageSchema } from '../validators/message-validators';
import {
  authenticatedRateLimiter,
  strictRateLimiter,
} from '../middleware/rate-limit-middleware';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateJWT);

// Apply authenticated rate limiter
router.use(authenticatedRateLimiter);

/**
 * Link Management
 */

// Create link
router.post(
  '/api/v1/dashboard/links',
  strictRateLimiter, // Stricter rate limit for link creation
  validateBody(createLinkSchema),
  createLink
);

// Get all user links
router.get('/api/v1/dashboard/links', validateQuery(paginationSchema), getUserLinks);

// Get message counts (lightweight polling) — must be before /:link_id
router.get('/api/v1/dashboard/links/counts', getMessageCounts);

// Get specific link
router.get('/api/v1/dashboard/links/:link_id', validateParams(linkIdSchema), getLinkById);

// Update link
router.patch(
  '/api/v1/dashboard/links/:link_id',
  validateParams(linkIdSchema),
  validateBody(updateLinkSchema),
  updateLink
);

// Delete link
router.delete('/api/v1/dashboard/links/:link_id', validateParams(linkIdSchema), deleteLink);

/**
 * Thread Management
 */

// Get threads for a link
router.get(
  '/api/v1/dashboard/links/:link_id/threads',
  validateParams(linkIdSchema),
  validateQuery(paginationSchema),
  getLinkThreads
);

// Get thread with messages
router.get(
  '/api/v1/dashboard/threads/:thread_id',
  validateParams(threadIdSchema),
  validateQuery(paginationSchema),
  getThreadWithMessages
);

// Reply to thread
router.post(
  '/api/v1/dashboard/threads/:thread_id/reply',
  validateParams(threadIdSchema),
  validateBody(replyMessageSchema),
  replyToThread
);

/**
 * Burn Operations
 */

// Burn thread
router.post(
  '/api/v1/dashboard/threads/:thread_id/burn',
  validateParams(threadIdSchema),
  burnThread
);

// Burn link (burns all threads)
router.post('/api/v1/dashboard/links/:link_id/burn', validateParams(linkIdSchema), burnLink);

export default router;
