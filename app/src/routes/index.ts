/**
 * Routes Index
 * Registers all application routes
 */

import { Express } from 'express';
import publicRoutes from './public-routes';
import dashboardRoutes from './dashboard-routes';
import { dashboardRoomRoutes, publicRoomRoutes } from './room-routes';
import { publicBroadcastRoutes, dashboardBroadcastRoutes } from './broadcast-routes';
import { logger } from '../config/logger';

const disableRoomRoutes = process.env.DISABLE_ROOM_ROUTES === 'true';

/**
 * Register all routes
 */
export function registerRoutes(app: Express): void {
  // Public routes (unauthenticated)
  app.use('/', publicRoutes);

  // Public broadcast routes (create, get posts, add post, burn)
  app.use('/', publicBroadcastRoutes);

  if (!disableRoomRoutes) {
    // Public room routes (anonymous)
    app.use('/', publicRoomRoutes);
    // Dashboard room routes (authenticated)
    app.use('/', dashboardRoomRoutes);
  }

  // Dashboard routes (authenticated)
  app.use('/', dashboardRoutes);

  // Dashboard broadcast routes (list owner channels)
  app.use('/', dashboardBroadcastRoutes);

  logger.info('Routes registered', { disableRoomRoutes });
}
