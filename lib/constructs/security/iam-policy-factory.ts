/**
 * IAM Policy Factory
 * Creates least-privilege IAM policies
 * File size: ~190 lines
 */

import * as iam from 'aws-cdk-lib/aws-iam';

export class IamPolicyFactory {
  /**
   * Create Secrets Manager read policy for specific secrets
   * https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
   */
  static createSecretsManagerPolicy(secretArns: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resources: secretArns,
    });
  }

  /**
   * Create SSM Parameter Store read policy for specific paths
   */
  static createSSMParameterPolicy(parameterPaths: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
      resources: parameterPaths,
    });
  }

  /**
   * Create S3 read-only policy for deployment artifacts
   */
  static createS3ReadOnlyPolicy(bucketArn: string, prefixes: string[]): iam.PolicyStatement {
    const resources = prefixes.map((prefix) => `${bucketArn}/${prefix}/*`);
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [bucketArn, ...resources],
    });
  }

  /**
   * Create CloudWatch Logs policy for specific log group
   */
  static createCloudWatchLogsPolicy(logGroupArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams',
      ],
      resources: [`${logGroupArn}:*`],
    });
  }

  /**
   * Create X-Ray tracing policy
   */
  static createXRayPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      resources: ['*'],
    });
  }

  /**
   * Create CloudWatch metrics policy
   */
  static createCloudWatchMetricsPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    });
  }

  /**
   * Create SSM Session Manager policy
   * https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-privatelink.html
   */
  static createSSMSessionManagerPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:UpdateInstanceInformation',
        'ssmmessages:CreateControlChannel',
        'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel',
        'ssmmessages:OpenDataChannel',
      ],
      resources: ['*'],
    });
  }

  /**
   * Create EC2 describe policy for CloudWatch agent
   */
  static createEC2DescribePolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ec2:DescribeInstances', 'ec2:DescribeTags'],
      resources: ['*'],
    });
  }

  /**
   * Create CodeDeploy agent policy for VPC endpoint mode
   * Required when agent communicates via codedeploy-commands-secure endpoint
   * https://docs.aws.amazon.com/codedeploy/latest/userguide/vpc-endpoints.html
   */
  static createCodeDeployAgentPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'codedeploy-commands-secure:GetDeploymentSpecification',
        'codedeploy-commands-secure:PollHostCommand',
        'codedeploy-commands-secure:PutHostCommandAcknowledgement',
        'codedeploy-commands-secure:PutHostCommandComplete',
      ],
      resources: ['*'],
    });
  }

  /**
   * Create S3 read policy for CodeDeploy resource kit bucket.
   * In a NAT-free VPC, the agent installer is fetched from s3://aws-codedeploy-{region}/
   * via the S3 gateway endpoint, which requires IAM auth.
   * https://docs.aws.amazon.com/codedeploy/latest/userguide/codedeploy-agent-operations-install-linux.html
   */
  static createCodeDeployS3Policy(region: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::aws-codedeploy-${region}`,
        `arn:aws:s3:::aws-codedeploy-${region}/*`,
      ],
    });
  }

  /**
   * Create CodeDeploy policy for EC2 instances
   */
  static createCodeDeployPolicy(region: string, accountId: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'codedeploy:CreateDeployment',
        'codedeploy:GetDeployment',
        'codedeploy:GetDeploymentConfig',
        'codedeploy:GetApplicationRevision',
        'codedeploy:RegisterApplicationRevision',
      ],
      resources: [
        `arn:aws:codedeploy:${region}:${accountId}:deploymentgroup:*`,
        `arn:aws:codedeploy:${region}:${accountId}:application:*`,
      ],
    });
  }
}
