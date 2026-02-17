/**
 * Broadcast Routes
 * Public: create channel, get posts, add post, burn. Dashboard: list owner channels.
 */

import { Router } from 'express';
import {
  createChannel,
  getPosts,
  addPost,
  burnChannel,
  getOwnerChannels,
  deleteChannel,
} from '../controllers/broadcast-controller';
import { optionalAuthenticateJWT, authenticateJWT } from '../middleware/auth-middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation-middleware';
import {
  createBroadcastChannelSchema,
  channelIdSchema,
  addPostSchema,
  burnChannelSchema,
  listPostsQuerySchema,
} from '../validators/broadcast-validators';
import {
  broadcastPostsRateLimiter,
  broadcastChannelPostRateLimiter,
  broadcastGuestIpRateLimiter,
  publicRateLimiter,
  authenticatedRateLimiter,
} from '../middleware/rate-limit-middleware';

export const publicBroadcastRoutes = Router();

// Create channel (auth optional; if present, owner_user_id set for "My channels")
publicBroadcastRoutes.post(
  '/api/v1/broadcast',
  publicRateLimiter,
  optionalAuthenticateJWT,
  validateBody(createBroadcastChannelSchema),
  createChannel
);

// List posts (public, no auth; rate limit by IP; do not log identifiers)
publicBroadcastRoutes.get(
  '/api/v1/broadcast/:channel_id/posts',
  broadcastPostsRateLimiter,
  validateParams(channelIdSchema),
  validateQuery(listPostsQuerySchema),
  getPosts
);

// Add post (post_token in body, or guest post if channel allows)
publicBroadcastRoutes.post(
  '/api/v1/broadcast/:channel_id/posts',
  broadcastChannelPostRateLimiter,
  broadcastGuestIpRateLimiter,
  validateParams(channelIdSchema),
  validateBody(addPostSchema),
  addPost
);

// Burn channel (post_token in body)
publicBroadcastRoutes.post(
  '/api/v1/broadcast/:channel_id/burn',
  publicRateLimiter,
  validateParams(channelIdSchema),
  validateBody(burnChannelSchema),
  burnChannel
);

// Dashboard: list channels for authenticated owner
export const dashboardBroadcastRoutes = Router();
dashboardBroadcastRoutes.use(authenticateJWT);
dashboardBroadcastRoutes.use(authenticatedRateLimiter);

dashboardBroadcastRoutes.get('/api/v1/dashboard/broadcast', getOwnerChannels);
dashboardBroadcastRoutes.delete(
  '/api/v1/dashboard/broadcast/:channel_id',
  validateParams(channelIdSchema),
  deleteChannel
);
