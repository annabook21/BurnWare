/**
 * Send Controller
 * Handles anonymous message sending, public thread view, and OPSEC unlock
 * File size: ~240 lines
 */

import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';
import { getDb } from '../config/database';
import { CryptoUtils } from '../utils/crypto-utils';
import { TokenService } from '../services/token-service';
import { ThreadModel } from '../models/thread-model';
import { MessageModel } from '../models/message-model';

const messageService = new MessageService();
const threadModel = new ThreadModel();
const messageModel = new MessageModel();

/** Extract access token from header or query param */
function getAccessToken(req: Request): string | undefined {
  return (req.headers['x-access-token'] as string) || (req.query.access_token as string) || undefined;
}

/** Extract unlock nonce from header or query param */
function getUnlockToken(req: Request): string | undefined {
  return (req.headers['x-unlock-token'] as string) || (req.query.unlock_token as string) || undefined;
}

/**
 * Send anonymous message
 * POST /api/v1/send
 */
export const sendMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('send_message');

    try {
      const { recipient_link_id, ciphertext, sender_public_key, passphrase } = req.validated as {
        recipient_link_id: string;
        ciphertext: string;
        sender_public_key: string;
        passphrase?: string;
      };

      const result = await messageService.sendAnonymousMessage({
        recipient_link_id,
        ciphertext,
        sender_public_key,
        passphrase,
      });

      subsegment?.close();

      ResponseUtils.success(
        res,
        {
          thread_id: result.thread_id,
          created_at: result.created_at,
          access_token: result.access_token,
          opsec: result.opsec,
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
 * Anonymous sender follow-up reply to existing thread
 * POST /api/v1/thread/:thread_id/reply
 * Possession-based auth: knowing the thread_id IS the auth.
 * OPSEC threads also require a valid access token.
 */
export const sendAnonymousReply = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { thread_id } = req.params as Record<string, string>;
    const { ciphertext } = req.validated as { ciphertext: string };
    const accessToken = getAccessToken(req);

    const result = await messageService.sendAnonymousReply(thread_id, ciphertext, accessToken);

    ResponseUtils.success(res, {
      message_id: result.message_id,
      created_at: result.created_at,
    }, 201);
  }
);

/**
 * Get thread for anonymous sender (possession-based: thread_id in URL is the secret)
 * GET /api/v1/thread/:thread_id
 * OPSEC checks (in order): expired → access token → passphrase unlock
 */
export const getThreadPublic = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { thread_id } = req.params as Record<string, string>;

    const thread = await threadModel.findById(thread_id);
    if (!thread || thread.burned) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Thread not found or no longer available.' },
      });
      return;
    }

    // OPSEC: check thread expiry (24h TTL)
    if (TokenService.isExpired(thread.expires_at)) {
      res.status(410).json({
        success: false,
        error: { code: 'THREAD_EXPIRED', message: 'This thread has expired.' },
      });
      return;
    }

    // OPSEC: access token OR passphrase unlock (access token is sufficient on its own)
    let opsecAuthenticated = !thread.access_token_hash; // no OPSEC → auto-pass
    if (thread.access_token_hash) {
      const accessToken = getAccessToken(req);
      if (accessToken && CryptoUtils.hash(accessToken) === thread.access_token_hash) {
        opsecAuthenticated = true;
      }
    }
    if (!opsecAuthenticated && thread.passphrase_hash) {
      const unlockToken = getUnlockToken(req);
      if (unlockToken && TokenService.verifyUnlockNonce(thread_id, unlockToken)) {
        opsecAuthenticated = true;
      }
    }
    if (!opsecAuthenticated) {
      if (thread.passphrase_hash) {
        res.status(401).json({
          success: false,
          error: { code: 'PASSPHRASE_REQUIRED', message: 'This thread requires a passphrase.' },
        });
      } else {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Valid access token required.' },
        });
      }
      return;
    }

    const messages = await messageModel.findByThreadId(thread_id, 100, 0);
    ResponseUtils.success(res, {
      thread_id: thread.thread_id,
      created_at: thread.created_at,
      sender_public_key: thread.sender_public_key,
      messages: messages.map((m) => ({
        message_id: m.message_id,
        content: m.content,
        sender_type: m.sender_type,
        created_at: m.created_at,
      })),
    });
  }
);

/**
 * Unlock a passphrase-protected thread
 * POST /api/v1/thread/:thread_id/unlock
 * Verifies PBKDF2(passphrase) → returns HMAC session nonce (1h TTL)
 */
export const unlockThread = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { thread_id } = req.params as Record<string, string>;
    const { passphrase } = req.validated as { passphrase: string };

    const thread = await threadModel.findById(thread_id);
    if (!thread || thread.burned) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Thread not found.' },
      });
      return;
    }

    if (!thread.passphrase_hash || !thread.passphrase_salt) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_PASSPHRASE', message: 'This thread does not require a passphrase.' },
      });
      return;
    }

    // Check expiry before allowing unlock attempt
    if (TokenService.isExpired(thread.expires_at)) {
      res.status(410).json({
        success: false,
        error: { code: 'THREAD_EXPIRED', message: 'This thread has expired.' },
      });
      return;
    }

    const isValid = await CryptoUtils.pbkdf2Verify(passphrase, thread.passphrase_hash, thread.passphrase_salt);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_PASSPHRASE', message: 'Incorrect passphrase.' },
      });
      return;
    }

    const unlockToken = TokenService.generateUnlockNonce(thread_id);
    ResponseUtils.success(res, {
      unlock_token: unlockToken,
      expires_in: 3600,
    });
  }
);

/**
 * Get link metadata (for display on send page)
 * GET /api/v1/link/:link_id/metadata
 */
export const getLinkMetadata = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { link_id } = req.params as Record<string, string>;

    const linkService = new (await import('../services/link-service')).LinkService();
    const metadata = await linkService.getLinkMetadata(link_id);

    ResponseUtils.success(res, metadata);
  }
);

/**
 * Shallow health check — used by ALB target group (no DB dependency)
 */
export const healthCheck = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    ResponseUtils.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * Deep health check — tests database connectivity (for monitoring/alerting only)
 * GET /health/ready
 */
export const readinessCheck = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      await getDb().query('SELECT 1');
      ResponseUtils.success(res, {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'not_ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
);
