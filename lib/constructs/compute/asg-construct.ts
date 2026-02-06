/**
 * Auto Scaling Group Construct
 * Creates ASG with health checks and scaling policies
 * Per AWS best practice: do not use Signals unless user data calls cfn-signal.
 * https://docs.aws.amazon.com/autoscaling/ec2/userguide/creating-auto-scaling-groups-with-cloudformation.html
 * https://docs.aws.amazon.com/codedeploy/latest/userguide/integrations-aws-auto-scaling.html
 */

import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { NamingUtils } from '../../utils/naming';

export interface AsgConstructProps {
  vpc: ec2.IVpc;
  launchTemplate: ec2.ILaunchTemplate;
  targetGroup: elbv2.IApplicationTargetGroup;
  environment: string;
  minCapacity: number;
  maxCapacity: number;
  desiredCapacity: number;
  /** Set true only when user data sends cfn-signal; otherwise stack may roll back. */
  useSignals?: boolean;
}

export class AsgConstruct extends Construct {
  public readonly asg: autoscaling.AutoScalingGroup;

  constructor(scope: Construct, id: string, props: AsgConstructProps) {
    super(scope, id);

    const {
      vpc,
      launchTemplate,
      targetGroup,
      environment,
      minCapacity,
      maxCapacity,
      desiredCapacity,
      useSignals = false,
    } = props;

    // Create Auto Scaling Group
    // https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html
    // Only use Signals when user data sends cfn-signal; otherwise stack fails with 0 SUCCESS signals.
    // https://docs.aws.amazon.com/CloudFormation/latest/UserGuide/cfn-signal.html
    this.asg = new autoscaling.AutoScalingGroup(this, 'Asg', {
      autoScalingGroupName: NamingUtils.getResourceName('asg', environment),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      launchTemplate,
      minCapacity,
      maxCapacity,
      desiredCapacity,
      healthChecks: autoscaling.HealthChecks.withAdditionalChecks({
        gracePeriod: Duration.seconds(300),
        additionalTypes: [autoscaling.AdditionalHealthCheckType.ELB],
      }),
      updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
        maxBatchSize: 1,
        minInstancesInService: minCapacity,
        pauseTime: Duration.minutes(5),
      }),
      ...(useSignals && {
        signals: autoscaling.Signals.waitForMinCapacity({
          timeout: Duration.minutes(10),
        }),
      }),
    });

    // Attach to target group
    this.asg.attachToApplicationTargetGroup(targetGroup);

    // Add target tracking scaling policy - CPU based
    this.asg.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      cooldown: Duration.seconds(300),
    });
  }

  /**
   * Get ASG name
   */
  public getAsgName(): string {
    return this.asg.autoScalingGroupName;
  }

  /**
   * Get ASG ARN
   */
  public getAsgArn(): string {
    return this.asg.autoScalingGroupArn;
  }
}
