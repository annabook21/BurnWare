/**
 * Data Stack
 * Creates RDS PostgreSQL instance and deployment bucket for app artifacts
 * File size: ~160 lines
 */

import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { RdsConstruct } from '../constructs/storage/rds-construct';
import { TagUtils } from '../utils/tags';
import { NamingUtils } from '../utils/naming';

export interface DataStackProps extends StackProps {
  vpc: ec2.IVpc;
  rdsSecurityGroup: ec2.ISecurityGroup;
  environment: string;
  instanceType?: string;
  allocatedStorage?: number;
  backupRetentionDays?: number;
  enableMultiAz?: boolean;
  enableDeletionProtection?: boolean;
}

export class DataStack extends Stack {
  public readonly dbEndpoint: string;
  public readonly dbPort: string;
  public readonly dbSecretArn: string;
  public readonly deploymentBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const {
      vpc,
      rdsSecurityGroup,
      environment,
      instanceType,
      allocatedStorage,
      backupRetentionDays,
      enableMultiAz,
      enableDeletionProtection,
    } = props;

    // Create RDS PostgreSQL instance
    const rds = new RdsConstruct(this, 'Rds', {
      vpc,
      securityGroup: rdsSecurityGroup,
      environment,
      instanceType,
      allocatedStorage,
      backupRetentionDays,
      enableMultiAz,
      enableDeletionProtection,
    });

    this.dbEndpoint = rds.endpoint;
    this.dbPort = rds.port;
    this.dbSecretArn = rds.getSecretArn();

    // Deployment bucket for app and frontend artifacts
    const deploymentBucketResource = new s3.Bucket(this, 'DeploymentBucket', {
      bucketName: NamingUtils.getResourceName('deployments', environment),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      versioned: true,
    });
    this.deploymentBucket = deploymentBucketResource;

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });
    TagUtils.applyTierTag(this, 'data');
    if (backupRetentionDays && backupRetentionDays > 0) {
      TagUtils.applyBackupTag(this, 'daily');
    }

    // CloudFormation Outputs
    new CfnOutput(this, 'DbEndpoint', {
      value: this.dbEndpoint,
      description: 'RDS PostgreSQL Endpoint',
      exportName: `${environment}-db-endpoint`,
    });

    new CfnOutput(this, 'DbPort', {
      value: this.dbPort,
      description: 'RDS PostgreSQL Port',
      exportName: `${environment}-db-port`,
    });

    new CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecretArn,
      description: 'RDS Credentials Secret ARN',
      exportName: `${environment}-db-secret-arn`,
    });

    new CfnOutput(this, 'DbConnectionInfo', {
      value: rds.getConnectionString(),
      description: 'Database Connection String Template',
    });

    new CfnOutput(this, 'SslConnectionInfo', {
      value: 'SSL is enforced via rds.force_ssl=1 parameter. Use sslmode=require in connection string.',
      description: 'SSL Connection Information',
    });

    new CfnOutput(this, 'DeploymentBucketName', {
      value: deploymentBucketResource.bucketName,
      description: 'S3 bucket for app deployment artifacts',
      exportName: `${environment}-deployment-bucket`,
    });
  }
}
