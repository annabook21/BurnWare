#!/usr/bin/env node
/**
 * BurnWare CDK Application Entry Point
 * File size: ~135 lines
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { AppStack } from '../lib/stacks/app-stack';
import { WafStack } from '../lib/stacks/waf-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { DnsStack } from '../lib/stacks/dns-stack';
import { ObservabilityStack } from '../lib/stacks/observability-stack';
import { AppSyncStack } from '../lib/stacks/appsync-stack';
import { devConfig } from '../lib/config/environments/dev';
import { prodConfig } from '../lib/config/environments/prod';

const app = new cdk.App();

// Get environment from context
const environmentName = app.node.tryGetContext('environment') || 'dev';
const config = environmentName === 'prod' ? prodConfig : devConfig;

// Network Stack
const networkStack = new NetworkStack(app, `BurnWare-Network-${environmentName}`, {
  env: config.env,
  environment: environmentName,
  description: 'VPC, subnets, VPC endpoints, security groups',
});

// Auth Stack
const authStack = new AuthStack(app, `BurnWare-Auth-${environmentName}`, {
  env: config.env,
  environment: environmentName,
  domainPrefix: `burnware-${environmentName}`,
  description: 'Cognito User Pool for authentication',
});

// Data Stack
const dataStack = new DataStack(app, `BurnWare-Data-${environmentName}`, {
  env: config.env,
  vpc: networkStack.vpc,
  rdsSecurityGroup: networkStack.rdsSecurityGroup,
  environment: environmentName,
  instanceType: config.rdsInstanceType,
  backupRetentionDays: 7,
  enableMultiAz: config.enableMultiAz,
  enableDeletionProtection: config.enableDeletionProtection,
  description: 'RDS PostgreSQL database',
});
dataStack.addDependency(networkStack);

// DNS Stack (shared — creates Route 53 hosted zone for burnware.live)
// Deploy this first, then update nameservers at your domain registrar.
const dnsStack = config.hostedZoneDomain
  ? new DnsStack(app, 'BurnWare-DNS', {
      env: { ...config.env, region: 'us-east-1' },
      domainName: config.hostedZoneDomain,
      description: 'Route 53 hosted zone for burnware.live',
    })
  : undefined;

// WAF Stack (must be in us-east-1 for CloudFront)
const wafStack = new WafStack(app, `BurnWare-WAF-${environmentName}`, {
  env: { ...config.env, region: 'us-east-1' },
  environment: environmentName,
  scope: 'CLOUDFRONT',
  description: 'WAF WebACL with rate limiting and CAPTCHA',
});

// AppSync Events Stack (real-time WebSocket pub/sub)
const appSyncStack = new AppSyncStack(app, `BurnWare-AppSync-${environmentName}`, {
  env: config.env,
  environment: environmentName,
  description: 'AppSync Events API for real-time messaging',
});
appSyncStack.addDependency(networkStack);

// App Stack
const appStack = new AppStack(app, `BurnWare-App-${environmentName}`, {
  env: config.env,
  vpc: networkStack.vpc,
  publicSubnets: networkStack.publicSubnets,
  privateSubnets: networkStack.privateSubnets,
  albSecurityGroup: networkStack.albSecurityGroup,
  ec2SecurityGroup: networkStack.ec2SecurityGroup,
  userPoolArn: authStack.userPoolArn,
  cognitoUserPoolId: authStack.userPool,
  cognitoClientId: authStack.userPoolClient,
  environment: environmentName,
  domainName: config.domainName,
  certificateArn: config.certificateArn,
  asgMinCapacity: config.asgMinCapacity,
  asgMaxCapacity: config.asgMaxCapacity,
  asgDesiredCapacity: config.asgDesiredCapacity,
  dbSecretId: dataStack.dbSecretArn,
  dbEndpoint: dataStack.dbEndpoint,
  dbPort: dataStack.dbPort,
  deploymentBucket: dataStack.deploymentBucket,
  deployBackendArtifact: app.node.tryGetContext('deployBackend') !== 'false',
  appSyncHttpDns: appSyncStack.httpDns,
  appSyncApiKey: appSyncStack.apiKey,
  description: 'ALB, Auto Scaling Group, CodeDeploy',
});
appStack.addDependency(networkStack);
appStack.addDependency(authStack);
appStack.addDependency(dataStack);
appStack.addDependency(appSyncStack);

// Frontend Stack (depends on Auth + App + AppSync for Cognito, API URL, real-time)
const frontendStack = new FrontendStack(app, `BurnWare-Frontend-${environmentName}`, {
  env: config.env,
  environment: environmentName,
  domainName: config.domainName,
  certificateArn: config.certificateArn,
  webAclArn: wafStack.webAclArn,
  cognitoUserPoolId: authStack.userPool,
  cognitoClientId: authStack.userPoolClient,
  apiBaseUrl: '', // Same-origin: CloudFront proxies /api/* to ALB, avoids mixed content
  alb: appStack.alb,
  hostedZone: dnsStack?.hostedZone,
  appSyncHttpDns: appSyncStack.httpDns,
  appSyncRealtimeDns: appSyncStack.realtimeDns,
  appSyncApiKey: appSyncStack.apiKey,
  description: 'CloudFront distribution and S3 bucket for SPA',
});
frontendStack.addDependency(wafStack);
frontendStack.addDependency(authStack);
frontendStack.addDependency(appStack);
frontendStack.addDependency(appSyncStack);
if (dnsStack) frontendStack.addDependency(dnsStack);

// Observability Stack
const observabilityStack = new ObservabilityStack(
  app,
  `BurnWare-Observability-${environmentName}`,
  {
    env: config.env,
    environment: environmentName,
    alarmEmail: config.alarmEmail,
    logRetentionDays: config.logRetentionDays,
    alb: appStack.alb,
    description: 'CloudWatch logs, SNS notifications, and CloudWatch alarms',
  }
);
observabilityStack.addDependency(appStack);

// Add stack tags
cdk.Tags.of(app).add('Project', 'BurnWare');
cdk.Tags.of(app).add('Environment', environmentName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
