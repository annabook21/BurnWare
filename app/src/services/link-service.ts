/**
 * Link Service
 * Business logic for link management
 * File size: ~275 lines
 */

import { LinkModel, Link, CreateLinkData } from '../models/link-model';
import { TokenService } from './token-service';
import { QRCodeService } from './qr-code-service';
import { CryptoUtils } from '../utils/crypto-utils';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { getDb } from '../config/database';

const MAX_LINKS_PER_USER = 50;

export interface CreateLinkInput {
  display_name: string;
  description?: string;
  expires_in_days?: number;
  public_key?: string;
  opsec_mode?: boolean;
  opsec_access?: string;
  opsec_passphrase?: string;
}

export class LinkService {
  private linkModel: LinkModel;
  private qrCodeService: QRCodeService;

  constructor() {
    this.linkModel = new LinkModel();
    this.qrCodeService = new QRCodeService();
  }

  /**
   * Create new link
   */
  async createLink(userId: string, input: CreateLinkInput): Promise<Link> {
    // Check user hasn't exceeded max links
    const userLinkCount = await this.linkModel.countByUserId(userId);
    if (userLinkCount >= MAX_LINKS_PER_USER) {
      throw new ValidationError(`Maximum ${MAX_LINKS_PER_USER} links per user`);
    }

    // Generate unique link token
    const linkId = TokenService.generateLinkToken();

    // Calculate expiration
    const expiresAt = input.expires_in_days
      ? TokenService.generateExpirationDate(input.expires_in_days)
      : undefined;

    // Hash OPSEC passphrase if provided (PBKDF2, 600k iterations)
    let opsecPassphraseHash: string | undefined;
    let opsecPassphraseSalt: string | undefined;
    if (input.opsec_mode && input.opsec_passphrase) {
      const { hash, salt } = await CryptoUtils.pbkdf2Hash(input.opsec_passphrase);
      opsecPassphraseHash = hash;
      opsecPassphraseSalt = salt;
    }

    // Create link in database
    const linkData: CreateLinkData = {
      link_id: linkId,
      owner_user_id: userId,
      display_name: input.display_name,
      description: input.description,
      expires_at: expiresAt,
      public_key: input.public_key,
      opsec_mode: input.opsec_mode,
      opsec_access: input.opsec_mode ? input.opsec_access : undefined,
      opsec_passphrase_hash: opsecPassphraseHash,
      opsec_passphrase_salt: opsecPassphraseSalt,
    };

    const link = await this.linkModel.create(linkData);

    // Generate QR code asynchronously (don't wait)
    const baseUrl = process.env.BASE_URL || 'https://burnware.example.com';
    const linkUrl = `${baseUrl}/l/${linkId}`;

    this.qrCodeService
      .generateAndUpload(linkId, linkUrl)
      .then((qrUrl) => {
        logger.info('QR code generated', { link_id: linkId, qr_url: qrUrl });
      })
      .catch((error) => {
        logger.error('Failed to generate QR code', { error, link_id: linkId });
      });

    LoggerUtils.logMetric('link_created', 1, 'count');

    return link;
  }

  /**
   * Get link by ID
   */
  async getLinkById(linkId: string): Promise<Link> {
    const link = await this.linkModel.findById(linkId);

    if (!link) {
      throw new NotFoundError('Link');
    }

    // Check if expired
    if (TokenService.isExpired(link.expires_at)) {
      throw new NotFoundError('Link');
    }

    return link;
  }

  /**
   * Get all links for user
   */
  async getUserLinks(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ links: Link[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const links = await this.linkModel.findByUserId(userId, limit, offset);
    const total = await this.linkModel.countByUserId(userId);

    return {
      links,
      total,
      page,
      limit,
    };
  }

  /**
   * Update link
   */
  async updateLink(
    linkId: string,
    userId: string,
    updates: Partial<CreateLinkInput>
  ): Promise<Link> {
    // Verify ownership
    const link = await this.linkModel.findById(linkId);
    if (!link) {
      throw new NotFoundError('Link');
    }

    if (link.owner_user_id !== userId) {
      throw new AuthorizationError('Not authorized to update this link');
    }

    // Prepare update data
    const updateData: Partial<Link> = {
      display_name: updates.display_name,
      description: updates.description,
    };

    if (updates.expires_in_days !== undefined) {
      updateData.expires_at = TokenService.generateExpirationDate(updates.expires_in_days);
    }

    return await this.linkModel.update(linkId, updateData);
  }

  /**
   * Delete link
   */
  async deleteLink(linkId: string, userId: string): Promise<void> {
    // Verify ownership
    const link = await this.linkModel.findById(linkId);
    if (!link) {
      throw new NotFoundError('Link');
    }

    if (link.owner_user_id !== userId) {
      throw new AuthorizationError('Not authorized to delete this link');
    }

    // Delete link
    await this.linkModel.delete(linkId);

    // Delete QR code
    await this.qrCodeService.delete(linkId);

    LoggerUtils.logMetric('link_deleted', 1, 'count');
  }

  /**
   * Get message counts for all user links (lightweight polling)
   */
  async getMessageCounts(userId: string): Promise<{ link_id: string; message_count: number }[]> {
    return this.linkModel.getMessageCounts(userId);
  }

  /**
   * Get link metadata (public endpoint)
   */
  async getLinkMetadata(linkId: string): Promise<{
    display_name: string;
    description?: string;
    qr_code_url?: string;
    public_key?: string;
    opsec?: { enabled: boolean; access_mode?: string; passphrase_required: boolean };
  }> {
    const link = await this.getLinkById(linkId);

    return {
      display_name: link.display_name,
      description: link.description,
      qr_code_url: link.qr_code_url,
      public_key: link.public_key,
      ...(link.opsec_mode && {
        opsec: {
          enabled: true,
          access_mode: link.opsec_access,
          passphrase_required: !!link.opsec_passphrase_hash,
        },
      }),
    };
  }

  /**
   * Upload encrypted key backup for a link
   */
  async uploadKeyBackup(
    linkId: string,
    userId: string,
    data: { wrapped_key: string; salt: string; iv: string },
  ): Promise<void> {
    const link = await this.linkModel.findById(linkId);
    if (!link) throw new NotFoundError('Link');
    if (link.owner_user_id !== userId) throw new AuthorizationError('Not authorized');
    await this.linkModel.updateKeyBackup(linkId, data.wrapped_key, data.salt, data.iv);
  }

  /**
   * Get encrypted key backup for a link
   */
  async getKeyBackup(
    linkId: string,
    userId: string,
  ): Promise<{ wrapped_key: string; salt: string; iv: string } | null> {
    const link = await this.linkModel.findById(linkId);
    if (!link) throw new NotFoundError('Link');
    if (link.owner_user_id !== userId) throw new AuthorizationError('Not authorized');
    const backup = await this.linkModel.getKeyBackup(linkId);
    if (!backup) return null;
    return { wrapped_key: backup.wrapped_key, salt: backup.backup_salt, iv: backup.backup_iv };
  }

  /**
   * Burn link and all its threads/messages — atomic transaction
   */
  async burnLink(linkId: string, userId: string): Promise<void> {
    // Verify ownership (use raw query to include burned links)
    const linkResult = await getDb().query(
      'SELECT * FROM links WHERE link_id = $1',
      [linkId]
    );
    const link = linkResult.rows[0];

    if (!link) {
      throw new NotFoundError('Link');
    }

    if (link.owner_user_id !== userId) {
      throw new AuthorizationError('Not authorized to burn this link');
    }

    if (link.burned) {
      logger.info('Link already burned', { link_id: linkId });
      return;
    }

    // Atomic: delete all messages → burn all threads → mark link burned
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM messages WHERE thread_id IN (SELECT thread_id FROM threads WHERE link_id = $1)',
        [linkId]
      );
      await client.query(
        'UPDATE threads SET burned = TRUE WHERE link_id = $1',
        [linkId]
      );
      await client.query(
        'UPDATE links SET burned = TRUE WHERE link_id = $1',
        [linkId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    LoggerUtils.logMetric('link_burned', 1, 'count');
    LoggerUtils.logSecurityEvent('link_burned', {
      link_id: linkId,
      user_id: userId,
    });

    logger.info('Link burned successfully', {
      link_id: linkId,
      user_id: userId,
    });
  }
}
