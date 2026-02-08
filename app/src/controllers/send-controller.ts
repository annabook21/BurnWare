/**
 * Send Controller
 * Handles anonymous message sending and public thread view
 * File size: ~140 lines
 */

import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message-service';
import { ResponseUtils } from '../utils/response-utils';
import { asyncHandler } from '../middleware/error-middleware';
import { createSubsegment } from '../config/xray';
import { getDb } from '../config/database';
import { ThreadModel } from '../models/thread-model';
import { MessageModel } from '../models/message-model';

const messageService = new MessageService();
const threadModel = new ThreadModel();
const messageModel = new MessageModel();

/**
 * Send anonymous message
 * POST /api/v1/send
 */
export const sendMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const subsegment = createSubsegment('send_message');

    try {
      const { recipient_link_id, ciphertext, sender_public_key } = req.validated as {
        recipient_link_id: string;
        ciphertext: string;
        sender_public_key: string;
      };

      // Send E2EE message (server stores ciphertext, never sees plaintext)
      const result = await messageService.sendAnonymousMessage({
        recipient_link_id,
        ciphertext,
        sender_public_key,
      });

      subsegment?.close();

      ResponseUtils.success(
        res,
        {
          thread_id: result.thread_id,
          created_at: result.created_at,
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
 * Get thread for anonymous sender (possession-based: thread_id in URL is the secret)
 * GET /api/v1/thread/:thread_id
 * Returns 404 for non-existent or burned — same response to avoid enumeration.
 * Pattern: UUID as unguessable token (RFC 9562, OneTimeSecret/Privnote style).
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
