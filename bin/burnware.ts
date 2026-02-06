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
import { ObservabilityStack } from '../lib/stacks/observability-stack';
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

// WAF Stack (must be in us-east-1 for CloudFront)
const wafStack = new WafStack(app, `BurnWare-WAF-${environmentName}`, {
  env: { ...config.env, region: 'us-east-1' },
  environment: environmentName,
  scope: 'CLOUDFRONT',
  description: 'WAF WebACL with rate limiting and CAPTCHA',
});

// App Stack
const appStack = new AppStack(app, `BurnWare-App-${environmentName}`, {
  env: config.env,
  vpc: networkStack.vpc,
  publicSubnets: networkStack.publicSubnets,
  privateSubnets: networkStack.privateSubnets,
  albSecurityGroup: networkStack.albSecurityGroup,
  ec2SecurityGroup: networkStack.ec2SecurityGroup,
  userPoolArn: authStack.userPoolArn,
  environment: environmentName,
  domainName: config.domainName,
  certificateArn: config.certificateArn,
  asgMinCapacity: config.asgMinCapacity,
  asgMaxCapacity: config.asgMaxCapacity,
  asgDesiredCapacity: config.asgDesiredCapacity,
  dbSecretId: dataStack.dbSecretArn,
  dbEndpoint: dataStack.dbEndpoint,
  dbPort: dataStack.dbPort as unknown as string,
  deploymentBucket: dataStack.deploymentBucket,
  deployBackendArtifact: app.node.tryGetContext('deployBackend') === true,
  description: 'ALB, Auto Scaling Group, CodeDeploy',
});
appStack.addDependency(networkStack);
appStack.addDependency(authStack);
appStack.addDependency(dataStack);

// Look up the WAF WebACL ARN via context to avoid cross-region CDK token references.
// WAF must be in us-east-1 for CloudFront, but Frontend may be in a different region.
// Set via: cdk deploy -c wafAclArn=arn:aws:wafv2:...
const wafAclArn = app.node.tryGetContext('wafAclArn') || wafStack.webAclArn;

// Frontend Stack (depends on Auth + App for Cognito and API URL)
const frontendStack = new FrontendStack(app, `BurnWare-Frontend-${environmentName}`, {
  env: config.env,
  crossRegionReferences: true,
  environment: environmentName,
  domainName: config.domainName,
  certificateArn: config.certificateArn,
  webAclArn: wafAclArn,
  cognitoUserPoolId: authStack.userPool,
  cognitoClientId: authStack.userPoolClient,
  apiBaseUrl: `http://${appStack.albDnsName}`,
  description: 'CloudFront distribution and S3 bucket for SPA',
});
frontendStack.addDependency(wafStack);
frontendStack.addDependency(authStack);
frontendStack.addDependency(appStack);

// Observability Stack - simplified for initial deployment
const observabilityStack = new ObservabilityStack(
  app,
  `BurnWare-Observability-${environmentName}`,
  {
    env: config.env,
    environment: environmentName,
    alarmEmail: config.alarmEmail,
    logRetentionDays: config.logRetentionDays,
    description: 'CloudWatch logs and SNS notifications',
  }
);

// Add stack tags
cdk.Tags.of(app).add('Project', 'BurnWare');
cdk.Tags.of(app).add('Environment', environmentName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
