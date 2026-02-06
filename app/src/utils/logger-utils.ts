/**
 * Logger Utilities
 * Helper functions for structured logging
 * File size: ~110 lines
 */

import { logger } from '../config/logger';
import { Request } from 'express';

export interface LogContext {
  request_id?: string;
  trace_id?: string;
  user_id?: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  latency_ms?: number;
  [key: string]: unknown;
}

export class LoggerUtils {
  /**
   * Log request with context
   * https://docs.aws.amazon.com/prescriptive-guidance/latest/implementing-logging-monitoring-cloudwatch/welcome.html
   */
  static logRequest(
    level: 'info' | 'warn' | 'error',
    message: string,
    context: LogContext
  ): void {
    logger.log(level, message, context);
  }

  /**
   * Log API request
   */
  static logApiRequest(req: Request, statusCode: number, latency: number): void {
    const context: LogContext = {
      request_id: req.id,
      endpoint: req.path,
      method: req.method,
      status_code: statusCode,
      latency_ms: latency,
      user_id: (req as unknown as { user?: { sub: string } }).user?.sub || 'anonymous',
    };

    logger.info('API request completed', context);
  }

  /**
   * Log error with context
   */
  static logError(message: string, error: Error, context?: LogContext): void {
    logger.error(message, {
      ...context,
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
    });
  }

  /**
   * Log security event
   */
  static logSecurityEvent(
    event: string,
    details: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): void {
    logger.warn('Security event', {
      event_type: 'security',
      event,
      severity,
      ...details,
    });
  }

  /**
   * Log business metric
   */
  static logMetric(metricName: string, value: number, unit: string): void {
    logger.info('Business metric', {
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit,
      timestamp: new Date().toISOString(),
    });
  }
}
