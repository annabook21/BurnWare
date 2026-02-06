/**
 * Authentication Middleware
 * JWT validation using aws-jwt-verify
 * File size: ~175 lines
 */

import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AuthenticationError } from '../utils/error-utils';
import { logger } from '../config/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email: string;
        [key: string]: unknown;
      };
      id?: string;
    }
  }
}

// Create JWT verifier
// https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
const createVerifier = () => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    throw new Error('Cognito configuration missing');
  }

  return CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId,
  });
};

let verifier: ReturnType<typeof createVerifier> | null = null;

/**
 * Get or create JWT verifier instance
 */
function getVerifier() {
  if (!verifier) {
    verifier = createVerifier();
  }
  return verifier;
}

/**
 * Authentication middleware
 * Validates JWT token from Authorization header
 */
export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const payload = await getVerifier().verify(token);

    // Attach user to request
    req.user = {
      sub: payload.sub,
      email: payload.email as string,
      ...payload,
    };

    logger.debug('JWT validated successfully', {
      user_id: payload.sub,
      request_id: req.id,
    });

    next();
  } catch (error) {
    logger.warn('JWT validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      request_id: req.id,
    });

    if (error instanceof AuthenticationError) {
      next(error);
    } else {
      next(new AuthenticationError('Invalid or expired token'));
    }
  }
}

/**
 * Optional authentication middleware
 * Validates JWT if present, but allows request to continue if not
 */
export async function optionalAuthenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue as anonymous
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = await getVerifier().verify(token);

    req.user = {
      sub: payload.sub,
      email: payload.email as string,
      ...payload,
    };

    next();
  } catch (error) {
    // Invalid token, but don't fail - continue as anonymous
    logger.debug('Optional JWT validation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    next();
  }
}
