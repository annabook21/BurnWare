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
 * IP-based rate limiter for public endpoints
 * Note: WAF provides primary rate limiting, this is backup
 */
export const publicRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
});
