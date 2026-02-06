/**
 * Test Setup
 * Configuration for test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENVIRONMENT = 'test';
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_XRAY = 'false';
process.env.AWS_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'test-pool';
process.env.COGNITO_CLIENT_ID = 'test-client';
process.env.APP_SECRET = 'test-secret-key-for-testing-only';
process.env.BASE_URL = 'https://test.example.com';

// Extend Jest matchers if needed
