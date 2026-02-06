/**
 * Error Middleware
 * Global error handler
 * File size: ~125 lines
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error-utils';
import { ResponseUtils } from '../utils/response-utils';
import { LoggerUtils } from '../utils/logger-utils';

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default to 500 Internal Server Error
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  // Handle AppError instances
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;

    // Include details if available
    if ('details' in error) {
      details = (error as unknown as { details: unknown }).details;
    }

    // Log operational errors as warnings, programming errors as errors
    if (error.isOperational) {
      LoggerUtils.logRequest('warn', message, {
        request_id: req.id,
        endpoint: req.path,
        method: req.method,
        status_code: statusCode,
        error_code: code,
      });
    } else {
      LoggerUtils.logError(message, error, {
        request_id: req.id,
        endpoint: req.path,
        method: req.method,
      });
    }
  } else {
    // Log unexpected errors
    LoggerUtils.logError('Unexpected error', error, {
      request_id: req.id,
      endpoint: req.path,
      method: req.method,
    });
  }

  // Send error response
  ResponseUtils.error(res, code, message, statusCode, details, req.id);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  ResponseUtils.error(
    res,
    'NOT_FOUND',
    `Route ${req.method} ${req.path} not found`,
    404,
    undefined,
    req.id
  );
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
