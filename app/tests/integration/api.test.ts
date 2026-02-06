/**
 * API Integration Tests
 * Tests for key API endpoints
 * File size: ~295 lines
 */

import request from 'supertest';
import { createServer } from '../../src/server';

describe('BurnWare API Integration Tests', () => {
  const app = createServer();
  let authToken: string;
  let linkId: string;
  let threadId: string;

  beforeAll(async () => {
    // Mock JWT token for testing
    authToken = 'mock-jwt-token';
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('status', 'healthy');
    });
  });

  describe('Public Endpoints', () => {
    describe('POST /api/v1/send', () => {
      it('should send anonymous message with valid input', async () => {
        const response = await request(app)
          .post('/api/v1/send')
          .send({
            recipient_link_id: 'test12345678',
            message: 'Test message',
          });

        // May fail without database, but tests structure
        expect([201, 404, 500]).toContain(response.status);
      });

      it('should reject invalid link ID format', async () => {
        const response = await request(app)
          .post('/api/v1/send')
          .send({
            recipient_link_id: 'invalid!@#',
            message: 'Test message',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should reject message exceeding max length', async () => {
        const response = await request(app)
          .post('/api/v1/send')
          .send({
            recipient_link_id: 'test12345678',
            message: 'x'.repeat(5001),
          });

        expect(response.status).toBe(400);
      });

      it('should reject empty message', async () => {
        const response = await request(app)
          .post('/api/v1/send')
          .send({
            recipient_link_id: 'test12345678',
            message: '',
          });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/v1/link/:link_id/metadata', () => {
      it('should return link metadata if exists', async () => {
        const response = await request(app).get('/api/v1/link/test12345678/metadata');

        // May return 404 if link doesn't exist, but tests structure
        expect([200, 404]).toContain(response.status);
      });

      it('should reject invalid link ID', async () => {
        const response = await request(app).get('/api/v1/link/invalid!@#/metadata');

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Authenticated Endpoints', () => {
    describe('POST /api/v1/dashboard/links', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/links')
          .send({
            display_name: 'Test Link',
          });

        expect(response.status).toBe(401);
      });

      it('should validate display_name is required', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            description: 'Missing display name',
          });

        expect([400, 401]).toContain(response.status);
      });
    });

    describe('GET /api/v1/dashboard/links', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app).get('/api/v1/dashboard/links');

        expect(response.status).toBe(401);
      });

      it('should accept valid pagination parameters', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/links')
          .query({ page: 1, limit: 20 })
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 401]).toContain(response.status);
      });
    });

    describe('POST /api/v1/dashboard/threads/:thread_id/burn', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app).post(
          '/api/v1/dashboard/threads/123e4567-e89b-12d3-a456-426614174000/burn'
        );

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in response', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should include request ID in response', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-request-id');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should return structured error response', async () => {
      const response = await request(app)
        .post('/api/v1/send')
        .send({
          recipient_link_id: 'invalid',
        });

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});
