/**
 * Application Entry Point
 * File size: ~75 lines
 */

import dotenv from 'dotenv';
import path from 'path';
import { databaseConfig } from './config/database';
import { initializeTracing } from './config/tracing';
import { startServer } from './server';
import { logger } from './config/logger';

// Load environment variables (explicit path for PM2 cluster mode)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Initialize application
 */
async function initialize(): Promise<void> {
  try {
    logger.info('Starting BurnWare API server');

    // Initialize OpenTelemetry tracing
    await initializeTracing();

    // Initialize database connection
    await databaseConfig.initialize();
    logger.info('Database connected');

    // Start Express server
    const port = parseInt(process.env.PORT || '3000', 10);
    startServer(port);

    logger.info('Application initialized successfully', {
      port,
      environment: process.env.ENVIRONMENT,
    });
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

// Start application
initialize();
