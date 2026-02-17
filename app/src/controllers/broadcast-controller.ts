/**
 * Broadcast Controller
 * Create channel, list posts (public), add post, burn channel, list owner channels.
 * Do not log request body (post_token) or identifiers on public routes per design.
 */

import { Request, Response } from 'express';
import { BroadcastService } from '../services/broadcast-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';

const broadcastService = new BroadcastService();

/**
 * Create broadcast channel
 * POST /api/v1/broadcast
 * Auth optional; if present, sets owner_user_id for dashboard listing
 */
export const createChannel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = req.validated as { display_name: string; expires_at?: string | null; allow_guest_posts?: boolean };
    const ownerUserId = req.user?.sub ?? null;

    const result = await broadcastService.createChannel({
      display_name: body.display_name,
      expires_at: body.expires_at ? new Date(body.expires_at) : null,
      owner_user_id: ownerUserId,
      allow_guest_posts: body.allow_guest_posts,
    });

    ResponseUtils.success(
      res,
      {
        channel_id: result.channel_id,
        read_url: result.read_url,
        post_token: result.post_token,
        display_name: result.display_name,
      },
      201
    );
  }
);

/**
 * List posts (public, no auth)
 * GET /api/v1/broadcast/:channel_id/posts
 */
export const getPosts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const channel_id = req.params.channel_id as string;
    const query = (req.validated as { limit?: number; before?: string }) || {};
    const result = await broadcastService.listPosts({
      channel_id,
      limit: query.limit,
      before: query.before,
    });
    ResponseUtils.success(res, result);
  }
);

/**
 * Add post (requires post_token in body)
 * POST /api/v1/broadcast/:channel_id/posts
 */
export const addPost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const channel_id = req.params.channel_id as string;
    const body = req.validated as { post_token?: string; content: string };
    const created = await broadcastService.addPost({
      channel_id,
      post_token: body.post_token,
      content: body.content,
    });
    ResponseUtils.success(res, created, 201);
  }
);

/**
 * Burn channel (requires post_token in body)
 * POST /api/v1/broadcast/:channel_id/burn
 */
export const burnChannel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const channel_id = req.params.channel_id as string;
    const body = req.validated as { post_token: string };
    await broadcastService.burnChannel(channel_id, body.post_token);
    ResponseUtils.success(res, { burned: true });
  }
);

/**
 * Delete a burned channel (owner only)
 * DELETE /api/v1/dashboard/broadcast/:channel_id
 */
export const deleteChannel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub;
    const channel_id = req.params.channel_id as string;
    await broadcastService.deleteChannel(channel_id, userId);
    ResponseUtils.success(res, { deleted: true });
  }
);

/**
 * List channels for authenticated owner
 * GET /api/v1/dashboard/broadcast
 */
export const getOwnerChannels = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub;
    const channels = await broadcastService.listChannelsByOwner(userId);
    ResponseUtils.success(res, { channels });
  }
);
