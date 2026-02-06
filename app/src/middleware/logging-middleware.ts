/**
 * Logging Middleware
 * Request logging with timing
 * File size: ~105 lines
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getTraceId } from '../config/xray';

/**
 * Add request ID to all requests
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

/**
 * Log incoming requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request — omit IP and User-Agent to protect sender anonymity.
  // Rate limiting (which needs IP) runs separately via express-rate-limit.
  logger.info('Incoming request', {
    request_id: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    trace_id: getTraceId(),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data): Response {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      request_id: req.id,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      latency_ms: duration,
      trace_id: getTraceId(),
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'secret', 'authorization'];

  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}
