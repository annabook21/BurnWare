/**
 * Logger Configuration
 * Winston logger with structured JSON output
 * File size: ~95 lines
 */

import winston from 'winston';

// Structured log format for CloudWatch
// https://docs.aws.amazon.com/prescriptive-guidance/latest/implementing-logging-monitoring-cloudwatch/welcome.html
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'burnware-api',
    environment: process.env.ENVIRONMENT || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? structuredFormat
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: '/opt/burnware/logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: '/opt/burnware/logs/application.log',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

/**
 * Log with request context
 */
export const logWithContext = (
  level: string,
  message: string,
  context: Record<string, unknown>
) => {
  logger.log(level, message, context);
};

/**
 * Create child logger with additional context
 */
export const createRequestLogger = (requestId: string, traceId?: string) => {
  return logger.child({
    request_id: requestId,
    trace_id: traceId,
  });
};
