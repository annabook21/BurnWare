/**
 * Production environment configuration
 * File size: ~70 lines
 */

import { Environment } from 'aws-cdk-lib';
import { EnvironmentConfig } from './dev';

export const prodConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  domainName: 'burnware.example.com',
  enableDeletionProtection: true,
  enableBackup: true,
  enableMultiAz: true,
  asgMinCapacity: 2,
  asgMaxCapacity: 10,
  asgDesiredCapacity: 2,
  rdsInstanceType: 'db.r6g.large',
  enableEnhancedMonitoring: true,
  logRetentionDays: 90,
  alarmEmail: 'ops-alerts@example.com',
};
