/**
 * Crypto Utilities
 * Secure token generation and HMAC functions
 * File size: ~145 lines
 */

import crypto from 'crypto';

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
    return crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 16);
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
   * Hash IP address for privacy
   */
  static hashIP(ip: string, salt: string): string {
    return crypto.createHash('sha256').update(ip + salt).digest('hex');
  }

  /**
   * Generate anonymous sender ID
   */
  static generateAnonymousId(ip: string, userAgent: string, salt: string): string {
    const data = `${ip}${userAgent}${salt}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
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
