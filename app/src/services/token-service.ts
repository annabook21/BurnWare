/**
 * Token Service
 * Link token generation and validation
 * File size: ~115 lines
 */

import { CryptoUtils, getAppSecret } from '../utils/crypto-utils';
import { logger } from '../config/logger';

export class TokenService {
  /**
   * Generate unique link token
   */
  static generateLinkToken(): string {
    return CryptoUtils.generateLinkToken(12);
  }

  /**
   * Generate anonymous sender ID from request metadata
   */
  static generateAnonymousId(ip: string, userAgent: string): string {
    const salt = getAppSecret();
    return CryptoUtils.generateAnonymousId(ip, userAgent, salt);
  }

  /**
   * Hash IP address for storage
   */
  static hashIP(ip: string): string {
    const salt = getAppSecret();
    return CryptoUtils.hashIP(ip, salt);
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
}
