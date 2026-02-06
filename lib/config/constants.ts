/**
 * Global constants for BurnWare application
 * File size: ~60 lines
 */

export const APP_NAME = 'BurnWare';
export const APP_PREFIX = 'burnware';

// Network Configuration
export const VPC_CONFIG = {
  maxAzs: 2,
  natGateways: 0, // NAT-free architecture
  cidr: '10.0.0.0/16',
} as const;

// RDS Configuration (PostgreSQL 16 in construct; constants for reference only)
export const RDS_CONFIG = {
  engine: 'postgres',
  version: '16.11',
  instanceClass: 'db.t3.micro',
  allocatedStorage: 20,
  backupRetention: 7,
  parameterGroupFamily: 'postgres16',
} as const;

// Monitoring Configuration
export const MONITORING_CONFIG = {
  logRetentionDays: 30,
  alarmEvaluationPeriods: 2,
  alarmDatapointsToAlarm: 2,
} as const;

// WAF Configuration
export const WAF_CONFIG = {
  rateLimitThreshold: 10, // requests per 5 minutes
  captchaImmunityTime: 300, // seconds
} as const;

// CloudFront Configuration
export const CLOUDFRONT_CONFIG = {
  priceClass: 'PriceClass_100', // Use only North America and Europe
  indexCacheTtl: 300, // 5 minutes
  assetCacheTtl: 31536000, // 1 year
} as const;

// Application Configuration
export const APP_CONFIG = {
  maxLinksPerUser: 50,
  maxMessageLength: 5000,
  defaultLinkExpiryDays: 30,
} as const;

// Resource Naming
export const RESOURCE_NAMES = {
  vpc: `${APP_PREFIX}-vpc`,
  logGroup: `/aws/${APP_PREFIX}/application`,
  accessLogGroup: `/aws/${APP_PREFIX}/access`,
  alarmTopic: `${APP_PREFIX}-alerts`,
} as const;
