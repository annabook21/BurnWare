/**
 * Response Utilities
 * Standard response formatting
 * File size: ~75 lines
 */

import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export class ResponseUtils {
  /**
   * Send success response
   */
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = { data };
    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    code: string,
    message: string,
    statusCode: number,
    details?: unknown,
    requestId?: string
  ): void {
    const response: ApiResponse = {
      error: {
        code,
        message,
        details,
        request_id: requestId,
      },
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(res: Response, data: T[], pagination: ApiResponse['pagination']): void {
    const response: ApiResponse<T[]> = {
      data,
      pagination,
    };
    res.status(200).json(response);
  }
}
