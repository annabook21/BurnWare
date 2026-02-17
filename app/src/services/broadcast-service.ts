/**
 * Broadcast Service
 * Create channel (short id + post token), add post, list posts, burn channel.
 * Post token is hashed (SHA-256) before storage; never log or persist plaintext.
 */

import crypto from 'crypto';
import { BroadcastChannelModel } from '../models/broadcast-channel-model';
import { BroadcastPostModel } from '../models/broadcast-post-model';
import { CryptoUtils } from '../utils/crypto-utils';
import { ValidationError, NotFoundError } from '../utils/error-utils';
import { logger } from '../config/logger';
import { AppSyncPublisher } from './appsync-publisher';
import { getDb } from '../config/database';

const CHANNEL_ID_LENGTH = 12;
const POST_TOKEN_BYTES = 32;

export interface CreateChannelInput {
  display_name: string;
  expires_at?: Date | null;
  owner_user_id?: string | null;
  allow_guest_posts?: boolean;
}

export interface CreateChannelResult {
  channel_id: string;
  read_url: string;
  post_token: string;
  display_name: string;
}

export interface ListPostsInput {
  channel_id: string;
  limit?: number;
  before?: string;
}

export interface AddPostInput {
  channel_id: string;
  post_token?: string;
  content: string;
}

function generateChannelId(): string {
  return crypto.randomBytes(CHANNEL_ID_LENGTH).toString('base64url').replace(/[+/=]/g, '').substring(0, 12);
}

function generatePostToken(): string {
  return crypto.randomBytes(POST_TOKEN_BYTES).toString('base64url');
}

function getReadUrlBase(): string {
  return process.env.BROADCAST_READ_URL_BASE || 'https://dev.burnware.live';
}

export class BroadcastService {
  private channelModel = new BroadcastChannelModel();
  private postModel = new BroadcastPostModel();
  private publisher = new AppSyncPublisher();

  private async ensureUserExists(userId: string): Promise<void> {
    const db = getDb();
    await db.query(
      `INSERT INTO users (user_id, email, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         updated_at = CURRENT_TIMESTAMP,
         last_login_at = CURRENT_TIMESTAMP`,
      [userId, `${userId}@unknown.local`]
    );
  }

  async createChannel(input: CreateChannelInput): Promise<CreateChannelResult> {
    if (input.owner_user_id) {
      await this.ensureUserExists(input.owner_user_id);
    }

    const channelId = generateChannelId();
    const postToken = generatePostToken();
    const postTokenHash = CryptoUtils.hash(postToken);

    await this.channelModel.create({
      channel_id: channelId,
      post_token_hash: postTokenHash,
      display_name: input.display_name,
      expires_at: input.expires_at ?? null,
      owner_user_id: input.owner_user_id ?? null,
      allow_guest_posts: input.allow_guest_posts ?? false,
    });

    const base = getReadUrlBase();
    const readUrl = `${base}/b/${channelId}`;

    return {
      channel_id: channelId,
      read_url: readUrl,
      post_token: postToken,
      display_name: input.display_name,
    };
  }

  private async verifyPostToken(channelId: string, postToken: string): Promise<void> {
    const channel = await this.channelModel.findByChannelId(channelId);
    if (!channel) {
      throw new NotFoundError('Broadcast channel');
    }
    if (channel.burned) {
      throw new ValidationError('Channel has been burned');
    }
    const hash = CryptoUtils.hash(postToken);
    if (hash !== channel.post_token_hash) {
      throw new ValidationError('Invalid post token');
    }
  }

  async addPost(input: AddPostInput): Promise<{ post_id: string; created_at: Date }> {
    const channel = await this.channelModel.findByChannelId(input.channel_id);
    if (!channel) throw new NotFoundError('Broadcast channel');
    if (channel.burned) throw new ValidationError('Channel has been burned');

    if (input.post_token) {
      const hash = CryptoUtils.hash(input.post_token);
      if (hash !== channel.post_token_hash) {
        throw new ValidationError('Invalid post token');
      }
    } else if (!channel.allow_guest_posts) {
      throw new ValidationError('Post token is required');
    }

    const post = await this.postModel.create({
      channel_id: input.channel_id,
      content: input.content,
    });
    this.publisher.publishBroadcastPost(input.channel_id).catch(() => {});
    return { post_id: post.post_id, created_at: post.created_at };
  }

  async listPosts(input: ListPostsInput): Promise<{
    posts: Array<{ post_id: string; content: string; created_at: Date }>;
    channel: { display_name: string; allow_guest_posts: boolean; burned: boolean };
  }> {
    const channel = await this.channelModel.findByChannelId(input.channel_id);
    if (!channel) {
      throw new NotFoundError('Broadcast channel');
    }
    if (channel.burned) {
      throw new NotFoundError('Broadcast channel');
    }
    const limit = Math.min(input.limit ?? 50, 100);
    const posts = await this.postModel.listByChannelId(input.channel_id, limit, input.before);
    return {
      posts: posts.map((p) => ({ post_id: p.post_id, content: p.content, created_at: p.created_at })),
      channel: {
        display_name: channel.display_name,
        allow_guest_posts: channel.allow_guest_posts,
        burned: channel.burned,
      },
    };
  }

  async burnChannel(channelId: string, postToken: string): Promise<void> {
    await this.verifyPostToken(channelId, postToken);
    await this.channelModel.burn(channelId);
    logger.info('Broadcast channel burned', { channel_id: channelId });
  }

  async deleteChannel(channelId: string, ownerUserId: string): Promise<void> {
    const deleted = await this.channelModel.delete(channelId, ownerUserId);
    if (!deleted) {
      throw new NotFoundError('Broadcast channel');
    }
    logger.info('Broadcast channel deleted', { channel_id: channelId });
  }

  async listChannelsByOwner(userId: string): Promise<Array<{
    channel_id: string;
    display_name: string;
    read_url: string;
    created_at: Date;
    burned: boolean;
    allow_guest_posts: boolean;
  }>> {
    const channels = await this.channelModel.findByOwnerUserId(userId);
    const base = getReadUrlBase();
    return channels.map((c) => ({
      channel_id: c.channel_id,
      display_name: c.display_name,
      read_url: `${base}/b/${c.channel_id}`,
      created_at: c.created_at,
      burned: c.burned,
      allow_guest_posts: c.allow_guest_posts,
    }));
  }
}
