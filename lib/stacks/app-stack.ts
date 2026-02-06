/**
 * App Stack
 * Creates ALB, Auto Scaling Group, and deploys backend API via CDK
 * File size: ~390 lines
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
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

    // Create Application Load Balancer
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/https-listener-certificates.html
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: NamingUtils.getResourceName('alb', environment),
      vpc,
      vpcSubnets: {
        subnets: publicSubnets,
      },
      internetFacing: true,
      securityGroup: albSecurityGroup,
      http2Enabled: true,
      dropInvalidHeaderFields: true,
    });

    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      targetGroupName: NamingUtils.getResourceName('tg', environment),
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

    // Deploy backend artifact to S3 when deployment bucket is provided and deployBackendArtifact is true
    if (deploymentBucket && deployBackendArtifact) {
      const appPath = path.join(__dirname, '../../app');
      new s3deploy.BucketDeployment(this, 'BackendDeploy', {
        sources: [
          s3deploy.Source.asset(appPath, {
            bundling: {
              image: DockerImage.fromRegistry('node:20-alpine'),
              command: [
                'sh',
                '-c',
                '(test -f package-lock.json && npm ci || npm install) && npm run build && mkdir -p /asset-output && (tar -czf /asset-output/app-' +
                  appVersion +
                  '.tar.gz dist package.json package-lock.json ecosystem.config.js deployment 2>/dev/null || tar -czf /asset-output/app-' +
                  appVersion +
                  '.tar.gz dist package.json ecosystem.config.js deployment)',
              ],
              user: 'root',
              local: {
                tryBundle(outputDir: string): boolean {
                  try {
                    const hasLock = fs.existsSync(path.join(appPath, 'package-lock.json'));
                    execSync(hasLock ? 'npm ci' : 'npm install', { cwd: appPath, stdio: 'inherit' });
                    execSync('npm run build', { cwd: appPath, stdio: 'inherit' });
                    const tarPath = path.resolve(outputDir, `app-${appVersion}.tar.gz`);
                    const lockFile = path.join(appPath, 'package-lock.json');
                    const tarFiles = fs.existsSync(lockFile)
                      ? 'dist package.json package-lock.json ecosystem.config.js deployment'
                      : 'dist package.json ecosystem.config.js deployment';
                    execSync(`tar -czf "${tarPath}" ${tarFiles}`, {
                      cwd: appPath,
                      stdio: 'inherit',
                    });
                    return true;
                  } catch {
                    return false;
                  }
                },
              },
            },
          }),
        ],
        destinationBucket: deploymentBucket,
        destinationKeyPrefix: 'releases/',
        extract: false, // we're deploying a single tarball, not extracting
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
