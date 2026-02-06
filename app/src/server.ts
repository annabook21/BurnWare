/**
 * Express Server Setup
 * File size: ~145 lines
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { AWSXRay } from './config/xray';
import { requestIdMiddleware, requestLogger } from './middleware/logging-middleware';
import { errorHandler, notFoundHandler } from './middleware/error-middleware';
import { registerRoutes } from './routes';
import { logger } from './config/logger';

/**
 * Create and configure Express application
 */
export function createServer(): Express {
  const app = express();

  // X-Ray tracing middleware (first)
  // https://docs.aws.amazon.com/xray/latest/devguide/xray-services-ec2.html
  if (process.env.ENABLE_XRAY !== 'false') {
    app.use(AWSXRay.express.openSegment('BurnWare'));
  }

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID and logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Trust proxy (behind ALB)
  app.set('trust proxy', 1);

  // Register routes
  registerRoutes(app);

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  // X-Ray tracing middleware (last)
  if (process.env.ENABLE_XRAY !== 'false') {
    app.use(AWSXRay.express.closeSegment());
  }

  return app;
}

/**
 * Start server
 */
export function startServer(port: number = 3000): void {
  const app = createServer();

  const server = app.listen(port, () => {
    logger.info(`Server listening on port ${port}`, {
      environment: process.env.ENVIRONMENT,
      port,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}
