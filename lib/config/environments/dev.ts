/**
 * Development environment configuration
 * File size: ~70 lines
 */

import { Environment } from 'aws-cdk-lib';

export interface EnvironmentConfig {
  env: Environment;
  domainName: string;
  hostedZoneDomain?: string;
  certificateArn?: string;
  enableDeletionProtection: boolean;
  enableBackup: boolean;
  enableMultiAz: boolean;
  asgMinCapacity: number;
  asgMaxCapacity: number;
  asgDesiredCapacity: number;
  rdsInstanceType: string;
  enableEnhancedMonitoring: boolean;
  logRetentionDays: number;
  alarmEmail: string;
}

export const devConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  domainName: 'dev.burnware.live',
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
  alarmEmail: 'dev-alerts@example.com',
};
