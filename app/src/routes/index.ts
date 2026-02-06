/**
 * Routes Index
 * Registers all application routes
 * File size: ~50 lines
 */

import { Express } from 'express';
import publicRoutes from './public-routes';
import dashboardRoutes from './dashboard-routes';
import { logger } from '../config/logger';

/**
 * Register all routes
 */
export function registerRoutes(app: Express): void {
  // Public routes (unauthenticated)
  app.use('/', publicRoutes);

  // Dashboard routes (authenticated)
  app.use('/', dashboardRoutes);

  logger.info('Routes registered');
}
