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

const logDir = process.env.LOG_DIR || '/opt/burnware/logs';
const useStdoutOnly = process.env.LOG_TO_STDOUT === 'true';

const consoleTransport = new winston.transports.Console({
  format: process.env.NODE_ENV === 'production'
    ? structuredFormat
    : winston.format.combine(winston.format.colorize(), winston.format.simple()),
});

const transports: winston.transport[] = [consoleTransport];

if (!useStdoutOnly) {
  transports.push(
    new winston.transports.File({
      filename: `${logDir}/error.log`,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: `${logDir}/application.log`,
      maxsize: 10485760,
      maxFiles: 5,
    }),
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'burnware-api',
    environment: process.env.ENVIRONMENT || 'development',
  },
  transports,
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
