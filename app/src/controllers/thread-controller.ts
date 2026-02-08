/**
 * Thread Controller
 * Handles thread operations
 * File size: ~165 lines
 */

import { Request, Response, NextFunction } from 'express';
import { ThreadService } from '../services/thread-service';
import { MessageService } from '../services/message-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';

const threadService = new ThreadService();
const messageService = new MessageService();

/**
 * Get threads for a link
 * GET /api/v1/dashboard/links/:link_id/threads
 */
export const getLinkThreads = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { link_id } = req.params as Record<string, string>;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await threadService.getThreadsByLinkId(link_id, userId, pageNum, limitNum);

    const totalPages = Math.ceil(result.total / limitNum);

    ResponseUtils.paginated(res, result.threads, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
      total_pages: totalPages,
    });
  }
);

/**
 * Get thread with messages
 * GET /api/v1/dashboard/threads/:thread_id
 */
export const getThreadWithMessages = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('get_thread');

    try {
      const userId = req.user!.sub;
      const { thread_id } = req.params as Record<string, string>;
      const { page, limit } = req.query as { page?: string; limit?: string };

      const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

      const result = await threadService.getThreadWithMessages(
        thread_id,
        userId,
        pageNum,
        limitNum
      );

      subsegment?.close();

      ResponseUtils.success(res, {
        thread_id: result.thread.thread_id,
        link_id: result.thread.link_id,
        sender_anonymous_id: result.thread.sender_anonymous_id,
        burned: result.thread.burned,
        created_at: result.thread.created_at,
        messages: result.messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total_messages,
          total_pages: Math.ceil(result.total_messages / limitNum),
        },
      });
    } catch (error) {
      subsegment?.addError(error as Error);
      subsegment?.close();
      throw error;
    }
  }
);

/**
 * Reply to thread (owner)
 * POST /api/v1/dashboard/threads/:thread_id/reply
 */
export const replyToThread = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { thread_id } = req.params as Record<string, string>;
    const { message } = req.validated as { message: string };

    const result = await messageService.sendOwnerReply(thread_id, userId, message);

    ResponseUtils.success(res, result, 201);
  }
);
