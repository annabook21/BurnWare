/**
 * Token Service
 * Link token generation, validation, and OPSEC unlock nonces
 * File size: ~85 lines
 */

import { CryptoUtils, getAppSecret } from '../utils/crypto-utils';

export class TokenService {
  /**
   * Generate unique link token
   */
  static generateLinkToken(): string {
    return CryptoUtils.generateLinkToken(12);
  }

  /**
   * Generate HMAC for thread verification
   */
  static generateThreadHMAC(threadId: string): string {
    const secret = getAppSecret();
    return CryptoUtils.generateHMAC(threadId, secret);
  }

  /**
   * Verify thread HMAC
   */
  static verifyThreadHMAC(threadId: string, hmac: string): boolean {
    const secret = getAppSecret();
    return CryptoUtils.verifyHMAC(threadId, hmac, secret);
  }

  /**
   * Validate link token format
   */
  static isValidLinkToken(token: string): boolean {
    // Check format: alphanumeric, URL-safe characters, 8-16 chars
    const regex = /^[A-Za-z0-9_-]{8,16}$/;
    return regex.test(token);
  }

  /**
   * Generate expiration date
   */
  static generateExpirationDate(days: number): Date {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  }

  /**
   * Check if date is expired
   */
  static isExpired(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) {
      return false; // No expiration
    }
    return new Date() > new Date(expiresAt);
  }

  /**
   * Generate HMAC-signed unlock nonce for passphrase sessions (1h default TTL).
   * Format: "timestamp:hmac" — avoids PBKDF2 on every poll.
   */
  static generateUnlockNonce(threadId: string): string {
    const timestamp = Date.now();
    const data = `${threadId}:unlock:${timestamp}`;
    const hmac = CryptoUtils.generateHMAC(data, getAppSecret());
    return `${timestamp}:${hmac}`;
  }

  /**
   * Verify unlock nonce: check HMAC validity and TTL (default 1h)
   */
  static verifyUnlockNonce(threadId: string, nonce: string, maxAgeMs: number = 3_600_000): boolean {
    const colonIdx = nonce.indexOf(':');
    if (colonIdx === -1) return false;
    const timestampStr = nonce.substring(0, colonIdx);
    const hmac = nonce.substring(colonIdx + 1);
    const timestamp = parseInt(timestampStr, 10);
    if (Number.isNaN(timestamp) || Date.now() - timestamp > maxAgeMs) return false;
    const data = `${threadId}:unlock:${timestamp}`;
    return CryptoUtils.verifyHMAC(data, hmac, getAppSecret());
  }
}
