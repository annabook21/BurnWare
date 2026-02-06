/**
 * Send Controller
 * Handles anonymous message sending
 * File size: ~110 lines
 */

import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';

const messageService = new MessageService();

/**
 * Send anonymous message
 * POST /api/v1/send
 */
export const sendMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('send_message');

    try {
      const { recipient_link_id, message } = req.validated as {
        recipient_link_id: string;
        message: string;
      };

      // Send message
      const result = await messageService.sendAnonymousMessage({
        recipient_link_id,
        message,
      });

      subsegment?.close();

      ResponseUtils.success(
        res,
        {
          thread_id: result.thread_id,
          created_at: result.created_at,
        },
        201
      );
    } catch (error) {
      subsegment?.addError(error as Error);
      subsegment?.close();
      throw error;
    }
  }
);

/**
 * Get link metadata (for display on send page)
 * GET /api/v1/link/:link_id/metadata
 */
export const getLinkMetadata = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { link_id } = req.params;

    const linkService = new (await import('../services/link-service')).LinkService();
    const metadata = await linkService.getLinkMetadata(link_id);

    ResponseUtils.success(res, metadata);
  }
);

/**
 * Health check endpoint
 */
export const healthCheck = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    ResponseUtils.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }
);
