/**
 * Observability Stack
 * Creates CloudWatch logs and SNS notifications
 * File size: ~90 lines (simplified for initial deployment)
 */

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LogGroupsConstruct } from '../constructs/observability/log-groups-construct';
import { AlertingConstruct } from '../constructs/observability/alerting-construct';
import { TagUtils } from '../utils/tags';

export interface ObservabilityStackProps extends StackProps {
  environment: string;
  alarmEmail: string;
  logRetentionDays?: number;
}

export class ObservabilityStack extends Stack {
  public readonly alarmTopicArn: string;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { environment, alarmEmail, logRetentionDays } = props;

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

    new CfnOutput(this, 'Note', {
      value: 'Alarms and dashboard will be created after full infrastructure deployment',
      description: 'Observability Note',
    });
  }
}
