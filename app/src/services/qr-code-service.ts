/**
 * QR Code Service
 * Generate QR codes for links
 * File size: ~110 lines
 */

import QRCode from 'qrcode';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../config/logger';

export class QRCodeService {
  private s3: S3Client;
  private bucketName: string;

  constructor() {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.bucketName = process.env.QR_CODE_BUCKET || 'burnware-qr-codes';
  }

  /**
   * Generate QR code and upload to S3
   */
  async generateAndUpload(linkId: string, url: string): Promise<string> {
    try {
      // Generate QR code as buffer
      const qrBuffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 512,
        margin: 2,
      });

      // Upload to S3
      const key = `qr-codes/${linkId}.png`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: qrBuffer,
          ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000', // 1 year
        })
      );

      // Return S3 URL
      const s3Url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      logger.info('QR code generated', { link_id: linkId, s3_url: s3Url });

      return s3Url;
    } catch (error) {
      logger.error('Failed to generate QR code', { error, link_id: linkId });
      throw error;
    }
  }

  /**
   * Generate QR code as data URL (for immediate response)
   */
  async generateDataUrl(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        width: 512,
        margin: 2,
      });
    } catch (error) {
      logger.error('Failed to generate QR code data URL', { error });
      throw error;
    }
  }

  /**
   * Delete QR code from S3
   */
  async delete(linkId: string): Promise<void> {
    try {
      const key = `qr-codes/${linkId}.png`;
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      logger.info('QR code deleted', { link_id: linkId });
    } catch (error) {
      logger.error('Failed to delete QR code', { error, link_id: linkId });
      // Don't throw - QR code deletion is not critical
    }
  }
}
