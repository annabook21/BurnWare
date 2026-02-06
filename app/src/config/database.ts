/**
 * Database Configuration
 * PostgreSQL connection pool setup
 * File size: ~115 lines
 */

import { Pool, PoolConfig } from 'pg';
import { SecretsManager } from 'aws-sdk';
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
  private secretsManager: SecretsManager;

  constructor() {
    this.secretsManager = new SecretsManager({
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
      const data = await this.secretsManager
        .getSecretValue({ SecretId: secretId })
        .promise();

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
        rejectUnauthorized: true,
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
    return this.pool;
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
