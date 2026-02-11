/**
 * Room Rate Limiters
 * Rate limiting for room join and messaging endpoints
 */

import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter for room join attempts
 * 10 attempts per 15 minutes per room (keyed by room info in token, not IP)
 * Uses a generic key since token is in body, not params
 */
export const roomJoinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Key by partial token hash to prevent token enumeration while still rate limiting
    const token = (req.body as { invite_token?: string })?.invite_token;
    if (token && token.length >= 8) {
      // Use first 8 chars as key (enough to rate limit without revealing full token)
      return `room_join:${token.substring(0, 8)}`;
    }
    return 'room_join:unknown';
  },
});

/**
 * Rate limiter for room message sending
 * 60 messages per 5 minutes per room+participant (allows burst but prevents spam)
 */
export const roomMessageRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // 60 messages per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const roomId = (req.params as { room_id?: string })?.room_id;
    const anonymousId = (req.body as { anonymous_id?: string })?.anonymous_id;
    if (roomId && anonymousId) {
      return `room_msg:${roomId}:${anonymousId}`;
    }
    return 'room_msg:unknown';
  },
});

/**
 * Rate limiter for room status polling
 * 120 requests per 5 minutes per room+participant (supports ~3 sec polling)
 */
export const roomStatusRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120, // 120 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const roomId = (req.params as { room_id?: string })?.room_id;
    const anonymousId = (req.query as { anonymous_id?: string })?.anonymous_id;
    if (roomId && anonymousId) {
      return `room_status:${roomId}:${anonymousId}`;
    }
    return 'room_status:unknown';
  },
});

/**
 * Rate limiter for room message polling
 * 120 requests per 5 minutes per room+participant (supports ~3 sec polling)
 * Prevents DoS via message polling endpoint
 */
export const roomMessagesRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120, // 120 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const roomId = (req.params as { room_id?: string })?.room_id;
    const anonymousId = (req.query as { anonymous_id?: string })?.anonymous_id;
    if (roomId && anonymousId) {
      return `room_messages:${roomId}:${anonymousId}`;
    }
    return 'room_messages:unknown';
  },
});
