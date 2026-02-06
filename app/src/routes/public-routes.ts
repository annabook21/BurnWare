/**
 * Public Routes
 * Unauthenticated endpoints
 * File size: ~85 lines
 */

import { Router } from 'express';
import { sendMessage, getLinkMetadata, healthCheck } from '../controllers/send-controller';
import { validateBody, validateParams } from '../middleware/validation-middleware';
import { sendMessageSchema } from '../validators/message-validators';
import { linkIdSchema } from '../validators/link-validators';
import { publicRateLimiter } from '../middleware/rate-limit-middleware';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/health', healthCheck);

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

export default router;
