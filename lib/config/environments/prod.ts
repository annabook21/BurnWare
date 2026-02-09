/**
 * Production environment configuration
 * File size: ~70 lines
 */

import { Environment } from 'aws-cdk-lib';
import { EnvironmentConfig } from './dev';

export const prodConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // Hardcoded: CloudFront requires ACM certs in us-east-1
  },
  domainName: 'burnware.live',
  hostedZoneDomain: 'burnware.live',
  enableDeletionProtection: false,
  enableBackup: false,
  enableMultiAz: false,
  asgMinCapacity: 1,
  asgMaxCapacity: 2,
  asgDesiredCapacity: 1,
  rdsInstanceType: 'db.t3.micro',
  enableEnhancedMonitoring: false,
  logRetentionDays: 7,
  alarmEmail: 'ops-alerts@example.com',
  // Share dev Cognito pool — single user base, frontend .env already has these values
  cognitoUserPoolId: 'us-east-1_uLCQ3TTxk',
  cognitoClientId: '7jsa7epi6jnmshvfnas34qsp7o',
};
