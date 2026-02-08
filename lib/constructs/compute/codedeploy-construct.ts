/**
 * CodeDeploy Construct
 * Creates CodeDeploy application and deployment group
 * File size: ~155 lines
 */

import { Construct } from 'constructs';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NamingUtils } from '../../utils/naming';

export interface CodeDeployConstructProps {
  asg: autoscaling.IAutoScalingGroup;
  serviceRole: iam.IRole;
  environment: string;
  deploymentConfigName?: string;
}

export class CodeDeployConstruct extends Construct {
  public readonly application: codedeploy.ServerApplication;
  public readonly deploymentGroup: codedeploy.ServerDeploymentGroup;

  constructor(scope: Construct, id: string, props: CodeDeployConstructProps) {
    super(scope, id);

    const {
      asg,
      serviceRole,
      environment,
      deploymentConfigName = 'CodeDeployDefault.OneAtATime',
    } = props;

    // Create CodeDeploy Application
    // https://docs.aws.amazon.com/codedeploy/latest/userguide/integrations-aws-auto-scaling.html
    this.application = new codedeploy.ServerApplication(this, 'Application', {
      applicationName: NamingUtils.getResourceName('codedeploy-app', environment),
    });

    // Get deployment configuration
    const deploymentConfig = codedeploy.ServerDeploymentConfig.fromServerDeploymentConfigName(
      this,
      'DeploymentConfig',
      deploymentConfigName
    );

    // Create Deployment Group
    this.deploymentGroup = new codedeploy.ServerDeploymentGroup(this, 'DeploymentGroup', {
      application: this.application,
      deploymentGroupName: NamingUtils.getResourceName('codedeploy-group', environment),
      autoScalingGroups: [asg],
      deploymentConfig,
      role: serviceRole,
      // Auto rollback configuration
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
        deploymentInAlarm: false, // Can be enabled with CloudWatch alarms
      },
      // Agent is installed explicitly in user data from S3 resource kit
      // with enable_auth_policy: true for VPC endpoint mode.
      installAgent: false,
    });
  }

  /**
   * Get application name
   */
  public getApplicationName(): string {
    return this.application.applicationName;
  }

  /**
   * Get deployment group name
   */
  public getDeploymentGroupName(): string {
    return this.deploymentGroup.deploymentGroupName;
  }

  /**
   * Get deployment group ARN
   */
  public getDeploymentGroupArn(): string {
    return this.deploymentGroup.deploymentGroupArn;
  }
}
