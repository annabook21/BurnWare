/**
 * App Stack
 * Creates ALB, Auto Scaling Group, and deploys backend API via CDK
 * File size: ~390 lines
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Stack, StackProps, CfnOutput, Duration, BundlingOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DockerImage } from 'aws-cdk-lib';
import { IamRolesConstruct } from '../constructs/security/iam-roles-construct';
import { LaunchTemplateConstruct } from '../constructs/compute/launch-template-construct';
import { AsgConstruct } from '../constructs/compute/asg-construct';
import { CodeDeployConstruct } from '../constructs/compute/codedeploy-construct';
import { UserDataConfig } from '../constructs/compute/user-data-builder';
import { TagUtils } from '../utils/tags';
import { NamingUtils } from '../utils/naming';
import { RESOURCE_NAMES } from '../config/constants';

export interface AppStackProps extends StackProps {
  vpc: ec2.IVpc;
  publicSubnets: ec2.ISubnet[];
  privateSubnets: ec2.ISubnet[];
  albSecurityGroup: ec2.ISecurityGroup;
  ec2SecurityGroup: ec2.ISecurityGroup;
  userPoolArn: string;
  /** Cognito User Pool ID (for backend JWT verification) */
  cognitoUserPoolId: string;
  /** Cognito App Client ID (for backend JWT verification) */
  cognitoClientId: string;
  environment: string;
  domainName: string;
  certificateArn?: string;
  asgMinCapacity: number;
  asgMaxCapacity: number;
  asgDesiredCapacity: number;
  /** When true, ASG waits for cfn-signal (requires cfn-signal in user data). Default false so stack completes. */
  asgUseSignals?: boolean;
  baseAmiId?: string;
  dbSecretId?: string;
  dbEndpoint?: string;
  dbPort?: string;
  /** S3 bucket for app deployment artifacts (from Data stack) */
  deploymentBucket?: s3.IBucket;
  appVersion?: string;
  /** Deploy backend artifact via CDK (default true when bucket provided). Set false to skip if app has build issues. */
  deployBackendArtifact?: boolean;
  /** AppSync Events HTTP domain (for real-time notifications) */
  appSyncHttpDns?: string;
  /** AppSync Events API key (for publishing events) */
  appSyncApiKey?: string;
  /** Lambda ARN for publishing AppSync Events from NAT-free VPC */
  appSyncPublishFnArn?: string;
}

export class AppStack extends Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly albDnsName: string;
  public readonly targetGroupArn: string;
  public readonly asgName: string;
  public readonly instanceRoleArn: string;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const {
      vpc,
      publicSubnets,
      privateSubnets,
      albSecurityGroup,
      ec2SecurityGroup,
      cognitoUserPoolId,
      cognitoClientId,
      environment,
      domainName,
      certificateArn,
      asgMinCapacity,
      asgMaxCapacity,
      asgDesiredCapacity,
      asgUseSignals = false,
      baseAmiId,
      dbSecretId,
      dbEndpoint,
      dbPort,
      deploymentBucket,
      appVersion = '1.0.0',
      deployBackendArtifact = true,
      appSyncHttpDns,
      appSyncApiKey,
      appSyncPublishFnArn,
    } = props;

    // Import existing log group (created by Observability stack)
    const logGroupName = NamingUtils.getLogGroupName('application', environment);
    const logGroup = logs.LogGroup.fromLogGroupName(this, 'AppLogGroup', logGroupName);

    const deploymentBucketArn = deploymentBucket?.bucketArn;

    // Create IAM roles
    const iamRoles = new IamRolesConstruct(this, 'IamRoles', {
      environment,
      logGroupArn: logGroup.logGroupArn,
      dbSecretArn: dbSecretId,
      deploymentBucketArn,
    });

    this.instanceRoleArn = iamRoles.getInstanceRoleArn();

    // Grant EC2 permission to invoke AppSync publish Lambda
    if (appSyncPublishFnArn) {
      iamRoles.ec2InstanceRole.addToPolicy(new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [appSyncPublishFnArn],
      }));
    }

    // Create Application Load Balancer
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/https-listener-certificates.html
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      // No explicit name: CloudFormation needs unique names during ALB replacement
      // (internetFacing change triggers replacement; old ALB blocks name reuse)
      vpc,
      vpcSubnets: {
        subnets: privateSubnets,
      },
      internetFacing: false,
      securityGroup: albSecurityGroup,
      http2Enabled: true,
      dropInvalidHeaderFields: true,
    });

    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      // No explicit name: allows CloudFormation to replace TG alongside ALB
      // (avoids "target group cannot be associated with more than one load balancer")
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        port: '3000',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: Duration.seconds(30),
      stickinessCookieDuration: Duration.hours(1),
    });

    this.targetGroupArn = targetGroup.targetGroupArn;

    // Create HTTPS listener with certificate
    let listener: elbv2.ApplicationListener;

    if (certificateArn) {
      const certificate = certificatemanager.Certificate.fromCertificateArn(
        this,
        'Certificate',
        certificateArn
      );

      listener = this.alb.addListener('HttpsListener', {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
        defaultTargetGroups: [targetGroup],
        sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      });
    } else {
      // For development, allow HTTP (production should always use HTTPS)
      listener = this.alb.addListener('HttpListener', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultTargetGroups: [targetGroup],
      });
    }

    // Prepare user data configuration (RDS endpoint/port from Data stack; secret does not include host/port)
    const userDataConfig: UserDataConfig | undefined =
      dbSecretId && dbEndpoint && dbPort
        ? {
            region: this.region,
            dbSecretId,
            dbEndpoint,
            dbPort,
            deploymentBucket: deploymentBucket?.bucketName ?? '',
            appVersion,
            logGroup: logGroup.logGroupName,
            environment,
            cognitoUserPoolId,
            cognitoClientId,
            appSyncHttpDns,
            appSyncApiKey,
            appSyncPublishFnArn,
            broadcastReadUrlBase: domainName ? `https://${domainName}` : undefined,
          }
        : undefined;

    // Create Launch Template
    const launchTemplate = new LaunchTemplateConstruct(this, 'LaunchTemplate', {
      vpc,
      securityGroup: ec2SecurityGroup,
      instanceRole: iamRoles.ec2InstanceRole,
      environment,
      amiId: baseAmiId,
      instanceType: 't3.micro',
      userDataConfig,
    });

    // Create Auto Scaling Group
    const asg = new AsgConstruct(this, 'Asg', {
      vpc,
      launchTemplate: launchTemplate.launchTemplate,
      targetGroup,
      environment,
      minCapacity: asgMinCapacity,
      maxCapacity: asgMaxCapacity,
      desiredCapacity: asgDesiredCapacity,
      useSignals: asgUseSignals,
    });

    this.asgName = asg.getAsgName();

    // Create CodeDeploy application and deployment group
    const codeDeploy = new CodeDeployConstruct(this, 'CodeDeploy', {
      asg: asg.asg,
      serviceRole: iamRoles.codeDeployServiceRole,
      environment,
      deploymentConfigName: 'CodeDeployDefault.OneAtATime',
    });

    this.albDnsName = this.alb.loadBalancerDnsName;

    // ALB access logging
    const albLogsBucket = new s3.Bucket(this, 'AlbLogsBucket', {
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED, // ALB access logs require SSE-S3 (not KMS)
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.alb.logAccessLogs(albLogsBucket);

    // Deploy backend artifact to S3 when deployment bucket is provided and deployBackendArtifact is true.
    // The artifact is a tarball with CodeDeploy-compatible structure:
    //   appspec.yml, scripts/  (CodeDeploy lifecycle hooks)
    //   dist/, node_modules/, package.json, ecosystem.config.js  (application)
    // node_modules contains production deps only (bundled so EC2 never needs npm/internet).
    if (deploymentBucket && deployBackendArtifact) {
      const appPath = path.join(__dirname, '../../app');
      const tarName = `app-${appVersion}.tar.gz`;

      // Shell commands to build → prune → stage flat CodeDeploy structure → tar.
      // Runs from the app/ directory. outputDir receives the final tarball.
      const bundleCommands = (outputDir: string) => [
        '(test -f package-lock.json && npm ci || npm install)',
        'npm run build',
        'npm prune --omit=dev',
        'rm -rf /tmp/_bw_stage && mkdir -p /tmp/_bw_stage/scripts',
        'cp deployment/appspec.yml /tmp/_bw_stage/',
        'cp deployment/scripts/*.sh /tmp/_bw_stage/scripts/',
        'cp -r dist /tmp/_bw_stage/',
        'cp -r node_modules /tmp/_bw_stage/',
        'cp package.json /tmp/_bw_stage/',
        'cp ecosystem.config.js /tmp/_bw_stage/',
        `COPYFILE_DISABLE=1 tar -czf "${outputDir}/${tarName}" -C /tmp/_bw_stage .`,
        'rm -rf /tmp/_bw_stage',
      ].join(' && ');

      new s3deploy.BucketDeployment(this, 'BackendDeploy', {
        sources: [
          s3deploy.Source.asset(appPath, {
            bundling: {
              image: DockerImage.fromRegistry('node:20-alpine'),
              command: ['sh', '-c', bundleCommands('/asset-output')],
              user: 'root',
              outputType: BundlingOutput.NOT_ARCHIVED,
              local: {
                tryBundle(outputDir: string): boolean {
                  try {
                    execSync(bundleCommands(outputDir), { cwd: appPath, stdio: 'inherit' });
                    // Restore devDependencies for local development
                    execSync('npm install', { cwd: appPath, stdio: 'inherit' });
                    return true;
                  } catch {
                    // Restore deps even on failure so local dev isn't broken
                    try { execSync('npm install', { cwd: appPath, stdio: 'pipe' }); } catch { /* best effort */ }
                    return false;
                  }
                },
              },
            },
          }),
        ],
        destinationBucket: deploymentBucket,
        destinationKeyPrefix: 'releases/',
      });
    }

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });
    TagUtils.applyTierTag(this, 'application');

    // CloudFormation Outputs
    new CfnOutput(this, 'AlbDnsName', {
      value: this.albDnsName,
      description: 'ALB DNS Name',
      exportName: `${environment}-alb-dns`,
    });

    new CfnOutput(this, 'AlbArn', {
      value: this.alb.loadBalancerArn,
      description: 'ALB ARN',
      exportName: `${environment}-alb-arn`,
    });

    new CfnOutput(this, 'TargetGroupArn', {
      value: this.targetGroupArn,
      description: 'Target Group ARN',
      exportName: `${environment}-target-group-arn`,
    });

    new CfnOutput(this, 'AsgName', {
      value: this.asgName,
      description: 'Auto Scaling Group Name',
      exportName: `${environment}-asg-name`,
    });

    new CfnOutput(this, 'CodeDeployApplicationName', {
      value: codeDeploy.getApplicationName(),
      description: 'CodeDeploy Application Name',
    });

    new CfnOutput(this, 'CodeDeployGroupName', {
      value: codeDeploy.getDeploymentGroupName(),
      description: 'CodeDeploy Deployment Group Name',
    });

    new CfnOutput(this, 'InstanceRoleArn', {
      value: this.instanceRoleArn,
      description: 'EC2 Instance Role ARN',
    });

    new CfnOutput(this, 'ListenerArn', {
      value: listener.listenerArn,
      description: 'ALB Listener ARN',
    });

    // Output connection instructions
    new CfnOutput(this, 'ConnectionInfo', {
      value: certificateArn
        ? `https://${domainName}`
        : `http://${this.albDnsName}`,
      description: 'Application URL',
    });
  }
}
