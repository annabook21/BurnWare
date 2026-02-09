/**
 * Public Routes
 * Unauthenticated endpoints
 * File size: ~85 lines
 */

import { Router } from 'express';
import {
  sendMessage,
  sendAnonymousReply,
  getLinkMetadata,
  getThreadPublic,
  unlockThread,
  healthCheck,
  readinessCheck,
} from '../controllers/send-controller';
import { validateBody, validateParams } from '../middleware/validation-middleware';
import { sendMessageSchema, replyMessageSchema } from '../validators/message-validators';
import { linkIdSchema } from '../validators/link-validators';
import { threadIdSchema, unlockThreadSchema } from '../validators/thread-validators';
import { publicRateLimiter, anonymousReplyRateLimiter, threadViewRateLimiter, unlockRateLimiter } from '../middleware/rate-limit-middleware';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/health', healthCheck);

/**
 * Deep health check — tests database connectivity (for monitoring only)
 * GET /health/ready
 */
router.get('/health/ready', readinessCheck);

/**
 * Send anonymous message
 * POST /api/v1/send
 * Protected by WAF rate limiting + CAPTCHA
 */
router.post(
  '/api/v1/send',
  publicRateLimiter,
  validateBody(sendMessageSchema),
  sendMessage
);

/**
 * Get link metadata
 * GET /api/v1/link/:link_id/metadata
 */
router.get(
  '/api/v1/link/:link_id/metadata',
  validateParams(linkIdSchema),
  getLinkMetadata
);

/**
 * Anonymous sender follow-up reply
 * POST /api/v1/thread/:thread_id/reply
 * Possession-based: thread_id in URL is the secret.
 */
router.post(
  '/api/v1/thread/:thread_id/reply',
  anonymousReplyRateLimiter,
  validateParams(threadIdSchema),
  validateBody(replyMessageSchema),
  sendAnonymousReply
);

/**
 * Unlock passphrase-protected thread
 * POST /api/v1/thread/:thread_id/unlock
 * Returns HMAC session nonce (1h TTL) on valid passphrase.
 */
router.post(
  '/api/v1/thread/:thread_id/unlock',
  unlockRateLimiter,
  validateParams(threadIdSchema),
  validateBody(unlockThreadSchema),
  unlockThread
);

/**
 * Get thread (for anonymous sender to view replies)
 * GET /api/v1/thread/:thread_id
 * Possession-based: thread_id in URL is the secret (UUID, unguessable).
 */
router.get(
  '/api/v1/thread/:thread_id',
  threadViewRateLimiter,
  validateParams(threadIdSchema),
  getThreadPublic
);

export default router;
