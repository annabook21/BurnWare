/**
 * Crypto Utilities
 * Secure token generation, HMAC, and PBKDF2 functions
 * File size: ~95 lines
 */

import crypto from 'crypto';

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = 'sha256';
const PBKDF2_SALT_LENGTH = 32;

export class CryptoUtils {
  /**
   * Generate cryptographically secure link token
   */
  static generateLinkToken(length: number = 12): string {
    return crypto.randomBytes(length).toString('base64url').substring(0, 16);
  }

  /**
   * Generate HMAC for thread verification
   */
  static generateHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  static verifyHMAC(data: string, hmac: string, secret: string): boolean {
    const expected = this.generateHMAC(data, secret);
    try {
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Generate secure random string
   */
  static generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data for storage
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash passphrase with PBKDF2 (OWASP 2023+ minimum: 600k iterations SHA-256)
   */
  static async pbkdf2Hash(passphrase: string): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(PBKDF2_SALT_LENGTH);
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(passphrase, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST,
        (err, key) => (err ? reject(err) : resolve(key)));
    });
    return { hash: derived.toString('hex'), salt: salt.toString('hex') };
  }

  /**
   * Verify passphrase against stored PBKDF2 hash (timing-safe)
   */
  static async pbkdf2Verify(passphrase: string, hash: string, salt: string): Promise<boolean> {
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(passphrase, Buffer.from(salt, 'hex'), PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST,
        (err, key) => (err ? reject(err) : resolve(key)));
    });
    try {
      return crypto.timingSafeEqual(derived, Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }
}

/**
 * Get application secret for HMACs
 * Should be stored in environment variable or Secrets Manager
 */
export function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error('APP_SECRET environment variable not set');
  }
  return secret;
}
