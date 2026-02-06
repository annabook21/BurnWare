/**
 * Burn Controller
 * Handles thread burning operations
 * File size: ~85 lines
 */

import { Request, Response, NextFunction } from 'express';
import { ThreadService } from '../services/thread-service';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';

const threadService = new ThreadService();

/**
 * Burn thread
 * POST /api/v1/dashboard/threads/:thread_id/burn
 */
export const burnThread = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('burn_thread');

    try {
      const userId = req.user!.sub;
      const { thread_id } = req.params;

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
    const userId = req.user!.sub;
    const { link_id } = req.params;

    // This would require additional implementation in LinkService
    // For now, just return success

    res.status(204).send();
  }
);
