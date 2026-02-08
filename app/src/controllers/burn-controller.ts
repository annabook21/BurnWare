/**
 * Burn Controller
 * Handles thread burning operations
 * File size: ~85 lines
 */

import { Request, Response, NextFunction } from 'express';
import { ThreadService } from '../services/thread-service';
import { LinkService } from '../services/link-service';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';

const threadService = new ThreadService();
const linkService = new LinkService();

/**
 * Burn thread
 * POST /api/v1/dashboard/threads/:thread_id/burn
 */
export const burnThread = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('burn_thread');

    try {
      const userId = req.user!.sub;
      const { thread_id } = req.params as Record<string, string>;

      await threadService.burnThread(thread_id, userId);

      subsegment?.close();

      // Return 204 No Content
      res.status(204).send();
    } catch (error) {
      subsegment?.addError(error as Error);
      subsegment?.close();
      throw error;
    }
  }
);

/**
 * Burn link (burns all threads)
 * POST /api/v1/dashboard/links/:link_id/burn
 */
export const burnLink = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('burn_link');

    try {
      const userId = req.user!.sub;
      const { link_id } = req.params as Record<string, string>;

      await linkService.burnLink(link_id, userId);

      subsegment?.close();
      res.status(204).send();
    } catch (error) {
      subsegment?.addError(error as Error);
      subsegment?.close();
      throw error;
    }
  }
);
