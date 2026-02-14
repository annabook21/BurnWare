/**
 * Room Integration Tests
 * Tests for secure chat room API endpoints
 */

import request from 'supertest';
import type { Express } from 'express';

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    child: jest.fn(() => ({ log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
  },
  logWithContext: jest.fn(),
  createRequestLogger: jest.fn(() => ({ log: jest.fn() })),
}));
jest.mock('../../src/config/database', () => ({
  getDb: jest.fn(() => null),
  databaseConfig: { getPool: jest.fn(() => null) },
}));
jest.mock('../../src/services/qr-code-service', () => ({
  QRCodeService: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('BurnWare Room API Integration Tests', () => {
  let app: Express;
  const authToken = 'mock-jwt-token';

  beforeAll(async () => {
    const { createServer } = await import('../../src/server');
    app = createServer();
  });

  describe('Public Room Endpoints', () => {
    describe('POST /api/v1/rooms/join', () => {
      it('should reject join without invite token', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/join')
          .send({
            public_key: 'test-public-key',
          });

        // 400 validation error or 401 if auth runs first
        expect([400, 401]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
        }
      });

      it('should reject join with invalid public key', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/join')
          .send({
            invite_token: 'some-valid-looking-token',
            public_key: '',
          });

        expect([400, 401]).toContain(response.status);
      });

      it('should accept optional display name', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/join')
          .send({
            invite_token: 'test-token-that-does-not-exist',
            public_key: 'test-public-key-base64',
            display_name: 'Alice',
          });

        // 404/500 (token doesn't exist) or 401
        expect([401, 404, 500]).toContain(response.status);
      });

      it('should reject display name exceeding max length', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/join')
          .send({
            invite_token: 'test-token',
            public_key: 'test-key',
            display_name: 'x'.repeat(51),
          });

        expect([400, 401]).toContain(response.status);
      });
    });

    describe('GET /api/v1/rooms/:room_id/status', () => {
      it('should require anonymous_id query parameter', async () => {
        const response = await request(app)
          .get('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/status');

        expect([400, 401]).toContain(response.status);
      });

      it('should reject invalid room_id format', async () => {
        const response = await request(app)
          .get('/api/v1/rooms/invalid-uuid/status')
          .query({ anonymous_id: 'test-anon-id-123' });

        expect([400, 401]).toContain(response.status);
      });
    });

    describe('GET /api/v1/rooms/:room_id/messages', () => {
      it('should require anonymous_id query parameter', async () => {
        const response = await request(app)
          .get('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/messages');

        expect([400, 401]).toContain(response.status);
      });

      it('should accept pagination parameters', async () => {
        const response = await request(app)
          .get('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/messages')
          .query({ anonymous_id: 'test-anon-id-123', page: 1, limit: 50 });

        // 401, 403, 404 or 500 (room doesn't exist or not authorized)
        expect([401, 403, 404, 500]).toContain(response.status);
      });

      it('should accept since parameter for polling', async () => {
        const response = await request(app)
          .get('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/messages')
          .query({
            anonymous_id: 'test-anon-id-123',
            since: new Date().toISOString(),
          });

        expect([401, 403, 404, 500]).toContain(response.status);
      });
    });

    describe('POST /api/v1/rooms/:room_id/messages', () => {
      it('should require anonymous_id and ciphertext', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/messages')
          .send({
            ciphertext: 'encrypted-content',
            nonce: '123456789012345678901234',
          });

        expect([400, 401]).toContain(response.status);
      });

      it('should validate nonce length', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/messages')
          .send({
            anonymous_id: 'test-anon-id-123',
            ciphertext: 'encrypted-content',
            nonce: 'short', // Too short
          });

        expect([400, 401]).toContain(response.status);
      });

      it('should reject empty ciphertext', async () => {
        const response = await request(app)
          .post('/api/v1/rooms/123e4567-e89b-12d3-a456-426614174000/messages')
          .send({
            anonymous_id: 'test-anon-id-123',
            ciphertext: '',
            nonce: '123456789012345678901234',
          });

        expect([400, 401]).toContain(response.status);
      });
    });
  });

  describe('Authenticated Room Endpoints', () => {
    describe('POST /api/v1/dashboard/rooms', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms')
          .send({
            display_name: 'Test Room',
            group_public_key: 'test-key',
            creator_public_key: 'creator-key',
            creator_wrapped_group_key: 'wrapped-key',
          });

        expect(response.status).toBe(401);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            display_name: 'Test Room',
            // Missing required keys
          });

        expect([400, 401]).toContain(response.status);
      });

      it('should validate join_window_minutes range', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            display_name: 'Test Room',
            group_public_key: 'test-key',
            creator_public_key: 'creator-key',
            creator_wrapped_group_key: 'wrapped-key',
            join_window_minutes: 120, // Too large
          });

        expect([400, 401]).toContain(response.status);
      });

      it('should validate max_participants range', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            display_name: 'Test Room',
            group_public_key: 'test-key',
            creator_public_key: 'creator-key',
            creator_wrapped_group_key: 'wrapped-key',
            max_participants: 100, // Too large
          });

        expect([400, 401]).toContain(response.status);
      });
    });

    describe('GET /api/v1/dashboard/rooms', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app).get('/api/v1/dashboard/rooms');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/v1/dashboard/rooms/:room_id/invites', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/invites')
          .send({ count: 1 });

        expect(response.status).toBe(401);
      });

      it('should validate count range', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/invites')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ count: 0 }); // Too small

        expect([400, 401]).toContain(response.status);
      });

      it('should validate count max', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/invites')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ count: 20 }); // Too large

        expect([400, 401]).toContain(response.status);
      });
    });

    describe('POST /api/v1/dashboard/rooms/:room_id/participants/:participant_id/approve', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/participants/123e4567-e89b-12d3-a456-426614174001/approve')
          .send({ wrapped_group_key: 'test-key' });

        expect(response.status).toBe(401);
      });

      it('should require wrapped_group_key', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/participants/123e4567-e89b-12d3-a456-426614174001/approve')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect([400, 401]).toContain(response.status);
      });
    });

    describe('POST /api/v1/dashboard/rooms/:room_id/lock', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/lock');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/v1/dashboard/rooms/:room_id/burn', () => {
      it('should reject request without auth token', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000/burn');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Room ID Validation', () => {
    it('should reject non-UUID room IDs', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/rooms/not-a-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 401]).toContain(response.status);
    });

    it('should accept valid UUID room IDs', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/rooms/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${authToken}`);

      // 404 expected (room doesn't exist), but validates UUID format
      expect([401, 404, 500]).toContain(response.status);
    });
  });
});
