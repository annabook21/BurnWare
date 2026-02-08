/**
 * Observability Stack
 * Creates CloudWatch logs, SNS notifications, and CloudWatch alarms
 */

import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LogGroupsConstruct } from '../constructs/observability/log-groups-construct';
import { AlertingConstruct } from '../constructs/observability/alerting-construct';
import { TagUtils } from '../utils/tags';

export interface ObservabilityStackProps extends StackProps {
  environment: string;
  alarmEmail: string;
  logRetentionDays?: number;
  /** ALB for health/5xx alarms (optional — alarms skipped if not provided) */
  alb?: elbv2.ApplicationLoadBalancer;
}

export class ObservabilityStack extends Stack {
  public readonly alarmTopicArn: string;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { environment, alarmEmail, logRetentionDays, alb } = props;

    // Create log groups
    const logGroups = new LogGroupsConstruct(this, 'LogGroups', {
      environment,
      retentionDays: logRetentionDays,
    });

    // Create alerting (SNS topic)
    const alerting = new AlertingConstruct(this, 'Alerting', {
      environment,
      alarmEmail,
    });

    this.alarmTopicArn = alerting.getTopicArn();

    // CloudWatch alarms for ALB health
    if (alb) {
      // Unhealthy host count alarm: fires when any target is persistently unhealthy
      const unhealthyAlarm = new cloudwatch.Alarm(this, 'UnhealthyHostAlarm', {
        alarmName: `${environment}-unhealthy-hosts`,
        alarmDescription: 'One or more ALB targets are unhealthy',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'UnHealthyHostCount',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName,
          },
          statistic: 'Minimum',
          period: Duration.minutes(1),
        }),
        threshold: 0,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      unhealthyAlarm.addAlarmAction(new cw_actions.SnsAction(alerting.alarmTopic));

      // 5XX error rate alarm: fires when backend returns >10 errors per minute
      const error5xxAlarm = new cloudwatch.Alarm(this, 'Target5xxAlarm', {
        alarmName: `${environment}-target-5xx`,
        alarmDescription: 'ALB targets returning elevated 5XX errors',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_Target_5XX_Count',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName,
          },
          statistic: 'Sum',
          period: Duration.minutes(1),
        }),
        threshold: 10,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      error5xxAlarm.addAlarmAction(new cw_actions.SnsAction(alerting.alarmTopic));
    }

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });

    // CloudFormation Outputs
    new CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopicArn,
      description: 'SNS Topic ARN for Alarms',
      exportName: `${environment}-alarm-topic-arn`,
    });

    new CfnOutput(this, 'ApplicationLogGroup', {
      value: logGroups.applicationLogGroup.logGroupName,
      description: 'Application Log Group Name',
    });

    new CfnOutput(this, 'AccessLogGroup', {
      value: logGroups.accessLogGroup.logGroupName,
      description: 'Access Log Group Name',
    });
  }
}
