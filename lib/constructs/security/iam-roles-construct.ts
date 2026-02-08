/**
 * IAM Roles Construct
 * Creates IAM roles with least-privilege policies
 * File size: ~220 lines
 */

import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IamPolicyFactory } from './iam-policy-factory';
import { NamingUtils } from '../../utils/naming';

export interface IamRolesConstructProps {
  environment: string;
  logGroupArn: string;
  dbSecretArn?: string;
  deploymentBucketArn?: string;
}

export class IamRolesConstruct extends Construct {
  public readonly ec2InstanceRole: iam.Role;
  public readonly codeDeployServiceRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamRolesConstructProps) {
    super(scope, id);

    const { environment, logGroupArn, dbSecretArn, deploymentBucketArn } = props;
    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;

    // Create EC2 Instance Role
    // https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
    this.ec2InstanceRole = new iam.Role(this, 'Ec2InstanceRole', {
      roleName: NamingUtils.getIamRoleName('ec2-instance', environment),
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for EC2 instances with least-privilege access',
      managedPolicies: [
        // Required for SSM Session Manager
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // Required for CloudWatch agent
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Add CloudWatch Logs policy
    this.ec2InstanceRole.addToPolicy(
      IamPolicyFactory.createCloudWatchLogsPolicy(logGroupArn)
    );

    // Add X-Ray policy
    this.ec2InstanceRole.addToPolicy(IamPolicyFactory.createXRayPolicy());

    // Add CloudWatch metrics policy
    this.ec2InstanceRole.addToPolicy(IamPolicyFactory.createCloudWatchMetricsPolicy());

    // Add SSM Session Manager policy
    this.ec2InstanceRole.addToPolicy(IamPolicyFactory.createSSMSessionManagerPolicy());

    // Add EC2 describe policy for CloudWatch agent
    this.ec2InstanceRole.addToPolicy(IamPolicyFactory.createEC2DescribePolicy());

    // Add Secrets Manager policy if DB secret is provided
    if (dbSecretArn) {
      this.ec2InstanceRole.addToPolicy(
        IamPolicyFactory.createSecretsManagerPolicy([dbSecretArn])
      );
    }

    // Add S3 read policy if deployment bucket is provided
    if (deploymentBucketArn) {
      this.ec2InstanceRole.addToPolicy(
        IamPolicyFactory.createS3ReadOnlyPolicy(deploymentBucketArn, ['releases', 'artifacts'])
      );
    }

    // Add CodeDeploy policy
    this.ec2InstanceRole.addToPolicy(
      IamPolicyFactory.createCodeDeployPolicy(region, accountId)
    );

    // Add CodeDeploy agent policy for VPC endpoint mode
    this.ec2InstanceRole.addToPolicy(
      IamPolicyFactory.createCodeDeployAgentPolicy()
    );

    // Add S3 read policy for CodeDeploy resource kit (NAT-free install)
    this.ec2InstanceRole.addToPolicy(
      IamPolicyFactory.createCodeDeployS3Policy(region)
    );

    // Create CodeDeploy Service Role (least privilege per Well-Architected SEC03-BP02)
    // https://docs.aws.amazon.com/codedeploy/latest/userguide/security_iam_service-with-iam.html
    this.codeDeployServiceRole = new iam.Role(this, 'CodeDeployServiceRole', {
      roleName: NamingUtils.getIamRoleName('codedeploy-service', environment),
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      description: 'IAM role for CodeDeploy service',
      inlinePolicies: {
        CodeDeployPolicy: new iam.PolicyDocument({
          statements: [
            // EC2 Describe actions don't support resource-level permissions — must use '*'
            new iam.PolicyStatement({
              sid: 'EC2ReadOnly',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:DescribeInstances',
                'ec2:DescribeInstanceStatus',
                'ec2:DescribeTags',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets',
                'ec2:DescribeNetworkInterfaces',
              ],
              resources: ['*'],
            }),
            // EC2 mutating actions scoped to tagged resources
            new iam.PolicyStatement({
              sid: 'EC2Mutate',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:TerminateInstances',
                'ec2:CreateTags',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: { 'aws:ResourceTag/Project': 'BurnWare' },
              },
            }),
            // iam:PassRole scoped to our EC2 instance role
            new iam.PolicyStatement({
              sid: 'PassRole',
              effect: iam.Effect.ALLOW,
              actions: ['iam:PassRole'],
              resources: [this.ec2InstanceRole.roleArn],
            }),
            // AutoScaling Describe actions don't support resource-level permissions
            new iam.PolicyStatement({
              sid: 'ASGReadOnly',
              effect: iam.Effect.ALLOW,
              actions: [
                'autoscaling:DescribeAutoScalingGroups',
                'autoscaling:DescribeLifecycleHooks',
                'autoscaling:DescribeTags',
              ],
              resources: ['*'],
            }),
            // AutoScaling mutating actions scoped to tagged resources
            new iam.PolicyStatement({
              sid: 'ASGMutate',
              effect: iam.Effect.ALLOW,
              actions: [
                'autoscaling:CompleteLifecycleAction',
                'autoscaling:DeleteLifecycleHook',
                'autoscaling:PutLifecycleHook',
                'autoscaling:RecordLifecycleActionHeartbeat',
                'autoscaling:CreateOrUpdateTags',
              ],
              resources: [`arn:aws:autoscaling:${region}:${accountId}:autoScalingGroup:*`],
              conditions: {
                StringEquals: { 'aws:ResourceTag/Project': 'BurnWare' },
              },
            }),
            // ELB Describe actions don't support resource-level permissions
            new iam.PolicyStatement({
              sid: 'ELBReadOnly',
              effect: iam.Effect.ALLOW,
              actions: [
                'elasticloadbalancing:DescribeTargetGroups',
                'elasticloadbalancing:DescribeTargetHealth',
                'elasticloadbalancing:DescribeLoadBalancers',
                'elasticloadbalancing:DescribeListeners',
                'elasticloadbalancing:DescribeLoadBalancerAttributes',
                'elasticloadbalancing:DescribeTargetGroupAttributes',
              ],
              resources: ['*'],
            }),
            // ELB mutating actions scoped to tagged target groups
            new iam.PolicyStatement({
              sid: 'ELBMutate',
              effect: iam.Effect.ALLOW,
              actions: [
                'elasticloadbalancing:RegisterTargets',
                'elasticloadbalancing:DeregisterTargets',
              ],
              resources: [`arn:aws:elasticloadbalancing:${region}:${accountId}:targetgroup/*`],
              conditions: {
                StringEquals: { 'aws:ResourceTag/Project': 'BurnWare' },
              },
            }),
            new iam.PolicyStatement({
              sid: 'TagRead',
              effect: iam.Effect.ALLOW,
              actions: ['tag:GetResources'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });
  }

  /**
   * Get EC2 instance profile ARN
   */
  public getInstanceRoleArn(): string {
    return this.ec2InstanceRole.roleArn;
  }

  /**
   * Get CodeDeploy service role ARN
   */
  public getCodeDeployRoleArn(): string {
    return this.codeDeployServiceRole.roleArn;
  }
}
