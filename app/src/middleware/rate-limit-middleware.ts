/**
 * Rate Limit Middleware
 * Application-level rate limiting for authenticated endpoints
 * File size: ~95 lines
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RateLimitError } from '../utils/error-utils';
import { logger } from '../config/logger';

/**
 * Rate limiter for authenticated endpoints (per user)
 */
export const authenticatedRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by user ID from JWT
    return req.user?.sub || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      request_id: req.id,
      user_id: req.user?.sub,
      endpoint: req.path,
    });

    throw new RateLimitError('Too many requests. Please try again later.');
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

/**
 * Strict rate limiter for sensitive operations (e.g., link creation)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?.sub || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Strict rate limit exceeded', {
      request_id: req.id,
      user_id: req.user?.sub,
      endpoint: req.path,
    });

    throw new RateLimitError('Rate limit exceeded for this operation');
  },
});

/**
 * Rate limiter for anonymous send endpoint
 * Uses recipient_link_id (never IP) to protect sender anonymity.
 * WAF provides primary IP-based rate limiting; this limits per-link abuse.
 */
export const publicRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes per link
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const linkId = (req.body as { recipient_link_id?: string })?.recipient_link_id;
    return linkId ? `link:${linkId}` : 'anon:unknown';
  },
});
