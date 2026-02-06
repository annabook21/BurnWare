/**
 * Link Controller
 * Handles link CRUD operations
 * File size: ~230 lines
 */

import { Request, Response, NextFunction } from 'express';
import { LinkService } from '../services/link-service';
import { ResponseUtils } from '../utils/response-utils';
import { NotFoundError } from '../utils/error-utils';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';

const linkService = new LinkService();

/**
 * Create new link
 * POST /api/v1/dashboard/links
 */
export const createLink = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('create_link');

    try {
      const userId = req.user!.sub;
      const input = req.validated as {
        display_name: string;
        description?: string;
        expires_in_days?: number;
      };

      const link = await linkService.createLink(userId, input);

      subsegment?.close();

      ResponseUtils.success(
        res,
        {
          link_id: link.link_id,
          display_name: link.display_name,
          description: link.description,
          expires_at: link.expires_at,
          qr_code_url: link.qr_code_url,
          created_at: link.created_at,
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
 * Get all links for authenticated user
 * GET /api/v1/dashboard/links
 */
export const getUserLinks = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const result = await linkService.getUserLinks(userId, pageNum, limitNum);

    const totalPages = Math.ceil(result.total / limitNum);

    ResponseUtils.paginated(res, result.links, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
      total_pages: totalPages,
    });
  }
);

/**
 * Get link by ID
 * GET /api/v1/dashboard/links/:link_id
 */
export const getLinkById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { link_id } = req.params;

    const link = await linkService.getLinkById(link_id);

    // Verify ownership
    if (link.owner_user_id !== userId) {
      throw new NotFoundError('Link');
    }

    ResponseUtils.success(res, link);
  }
);

/**
 * Update link
 * PATCH /api/v1/dashboard/links/:link_id
 */
export const updateLink = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { link_id } = req.params;
    const updates = req.validated as {
      display_name?: string;
      description?: string;
      expires_in_days?: number;
    };

    const link = await linkService.updateLink(link_id, userId, updates);

    ResponseUtils.success(res, link);
  }
);

/**
 * Delete link
 * DELETE /api/v1/dashboard/links/:link_id
 */
export const deleteLink = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.sub;
    const { link_id } = req.params;

    await linkService.deleteLink(link_id, userId);

    res.status(204).send();
  }
);
