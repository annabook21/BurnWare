/**
 * Validation Middleware
 * Request validation using Joi schemas
 * File size: ~120 lines
 */

import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError as JoiValidationError } from 'joi';
import { ValidationError } from '../utils/error-utils';
import { logger } from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      validated?: unknown;
    }
  }
}

/**
 * Validate request body against Joi schema
 */
export function validateBody(schema: Schema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof JoiValidationError) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        logger.warn('Validation failed', {
          request_id: req.id,
          endpoint: req.path,
          errors: details,
        });

        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate query parameters against Joi schema
 */
export function validateQuery(schema: Schema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.validateAsync(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof JoiValidationError) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        next(new ValidationError('Query validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate route parameters against Joi schema
 */
export function validateParams(schema: Schema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.validateAsync(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof JoiValidationError) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        next(new ValidationError('Parameter validation failed', details));
      } else {
        next(error);
      }
    }
  };
}
