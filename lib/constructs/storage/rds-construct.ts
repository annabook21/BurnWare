/**
 * RDS Construct
 * Creates RDS PostgreSQL instance with encryption and backups
 * File size: ~270 lines
 */

import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { RDS_CONFIG } from '../../config/constants';
import { NamingUtils } from '../../utils/naming';

export interface RdsConstructProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  environment: string;
  instanceType?: string;
  allocatedStorage?: number;
  backupRetentionDays?: number;
  enableMultiAz?: boolean;
  enableDeletionProtection?: boolean;
}

export class RdsConstruct extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly secret: secretsmanager.ISecret;
  public readonly endpoint: string;
  public readonly port: string;

  constructor(scope: Construct, id: string, props: RdsConstructProps) {
    super(scope, id);

    const {
      vpc,
      securityGroup,
      environment,
      instanceType = RDS_CONFIG.instanceClass,
      allocatedStorage = RDS_CONFIG.allocatedStorage,
      backupRetentionDays = RDS_CONFIG.backupRetention,
      enableMultiAz = false,
      enableDeletionProtection = false,
    } = props;

    // Create KMS key for encryption
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/rds.html
    const kmsKey = new kms.Key(this, 'RdsKmsKey', {
      description: `KMS key for RDS encryption - ${environment}`,
      enableKeyRotation: true,
      removalPolicy: enableDeletionProtection ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Create parameter group to force SSL
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/rds.html
    // Using PostgreSQL 16.11 - latest stable with support until Feb 2029
    const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      description: `PostgreSQL parameter group for ${environment}`,
      parameters: {
        'rds.force_ssl': '1', // Force SSL connections
        log_statement: 'all', // Log all statements for auditing
        log_min_duration_statement: '1000', // Log slow queries (>1s)
      },
    });

    // Create DB subnet group
    // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html
    const subnetGroup = new rds.SubnetGroup(this, 'SubnetGroup', {
      description: `DB subnet group for ${environment}`,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      removalPolicy: enableDeletionProtection ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Create master credentials secret
    const dbCredentials = new secretsmanager.Secret(this, 'DbCredentials', {
      secretName: NamingUtils.getResourceName('rds-credentials', environment),
      description: 'RDS PostgreSQL master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    this.secret = dbCredentials;

    // Create RDS instance
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/rds.html
    // Using PostgreSQL 16.11 - verified available in us-east-1 (Feb 2026)
    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      instanceIdentifier: NamingUtils.getResourceName('rds', environment),
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      subnetGroup,
      securityGroups: [securityGroup],
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'burnware',
      allocatedStorage,
      storageEncrypted: true,
      storageEncryptionKey: kmsKey,
      multiAz: enableMultiAz,
      publiclyAccessible: false,
      deletionProtection: enableDeletionProtection,
      backupRetention: Duration.days(backupRetentionDays),
      preferredBackupWindow: '03:00-04:00', // Off-peak hours
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      parameterGroup,
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.LONG_TERM,
      removalPolicy: enableDeletionProtection ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      autoMinorVersionUpgrade: false, // Controlled upgrades during maintenance windows
    });

    this.endpoint = this.instance.dbInstanceEndpointAddress;
    this.port = this.instance.dbInstanceEndpointPort;
  }

  /**
   * Get connection string for application
   */
  public getConnectionString(): string {
    return `postgresql://{{username}}:{{password}}@${this.endpoint}:${this.port}/burnware`;
  }

  /**
   * Get secret ARN
   */
  public getSecretArn(): string {
    return this.secret.secretArn;
  }
}
