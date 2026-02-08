/**
 * Database Configuration
 * PostgreSQL connection pool setup
 * File size: ~115 lines
 */

import { Pool, PoolConfig } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from './logger';

interface DbCredentials {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
}

class DatabaseConfig {
  private pool: Pool | null = null;
  private secretsManager: SecretsManagerClient;

  constructor() {
    this.secretsManager = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Retrieve database credentials from Secrets Manager
   * https://docs.aws.amazon.com/secretsmanager/latest/userguide/vpc-endpoint-overview.html
   */
  private async getCredentials(): Promise<DbCredentials> {
    const secretId = process.env.DB_SECRET_ID;
    if (!secretId) {
      throw new Error('DB_SECRET_ID environment variable not set');
    }

    try {
      const data = await this.secretsManager.send(
        new GetSecretValueCommand({ SecretId: secretId })
      );

      if (!data.SecretString) {
        throw new Error('Secret string is empty');
      }

      return JSON.parse(data.SecretString) as DbCredentials;
    } catch (error) {
      logger.error('Failed to retrieve database credentials', { error });
      throw error;
    }
  }

  /**
   * Initialize connection pool
   */
  async initialize(): Promise<Pool> {
    if (this.pool) {
      return this.pool;
    }

    const credentials = await this.getCredentials();

    const poolConfig: PoolConfig = {
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false, // RDS CA not in Node.js CA bundle; connection is within private VPC
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err });
    });

    logger.info('Database connection pool initialized');

    await this.runMigrations();

    return this.pool;
  }

  /**
   * Create tables if they don't exist
   */
  private async runMigrations(): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        link_id VARCHAR(64) PRIMARY KEY,
        owner_user_id VARCHAR(128) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        burned BOOLEAN NOT NULL DEFAULT FALSE,
        message_count INTEGER NOT NULL DEFAULT 0,
        qr_code_url VARCHAR(512)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS threads (
        thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        link_id VARCHAR(64) NOT NULL REFERENCES links(link_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        burned BOOLEAN NOT NULL DEFAULT FALSE,
        message_count INTEGER NOT NULL DEFAULT 0,
        sender_anonymous_id VARCHAR(128) NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sender_type VARCHAR(16) NOT NULL CHECK (sender_type IN ('anonymous', 'owner')),
        sender_id VARCHAR(128)
      )
    `);

    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_links_owner ON links(owner_user_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_threads_link ON threads(link_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)');

    // Trigger to auto-increment message_count on threads and links
    await this.pool.query(`
      CREATE OR REPLACE FUNCTION increment_message_count()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE threads SET message_count = message_count + 1 WHERE thread_id = NEW.thread_id;
        UPDATE links SET message_count = message_count + 1
          WHERE link_id = (SELECT link_id FROM threads WHERE thread_id = NEW.thread_id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await this.pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'increment_thread_message_count'
        ) THEN
          CREATE TRIGGER increment_thread_message_count
            AFTER INSERT ON messages
            FOR EACH ROW EXECUTE FUNCTION increment_message_count();
        END IF;
      END $$
    `);

    // Fix any existing message counts that are out of sync
    await this.pool.query(`
      UPDATE threads t SET message_count = (
        SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.thread_id
      ) WHERE t.message_count = 0 AND EXISTS (
        SELECT 1 FROM messages m WHERE m.thread_id = t.thread_id
      )
    `);
    await this.pool.query(`
      UPDATE links l SET message_count = (
        SELECT COUNT(*) FROM messages m
        JOIN threads t ON t.thread_id = m.thread_id
        WHERE t.link_id = l.link_id
      ) WHERE l.message_count = 0 AND EXISTS (
        SELECT 1 FROM threads t
        JOIN messages m ON m.thread_id = t.thread_id
        WHERE t.link_id = l.link_id
      )
    `);

    logger.info('Database migrations completed');
  }

  /**
   * Get connection pool
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Close connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    }
  }
}

export const databaseConfig = new DatabaseConfig();
export const getDb = () => databaseConfig.getPool();
