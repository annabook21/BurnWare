/**
 * Log Groups Construct
 * Creates CloudWatch Log Groups
 * File size: ~95 lines
 */

import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NamingUtils } from '../../utils/naming';
import { MONITORING_CONFIG } from '../../config/constants';

export interface LogGroupsConstructProps {
  environment: string;
  retentionDays?: number;
}

export class LogGroupsConstruct extends Construct {
  public readonly applicationLogGroup: logs.LogGroup;
  public readonly accessLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LogGroupsConstructProps) {
    super(scope, id);

    const { environment, retentionDays = MONITORING_CONFIG.logRetentionDays } = props;

    // Application log group for structured JSON logs
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/implementing-logging-monitoring-cloudwatch/welcome.html
    this.applicationLogGroup = new logs.LogGroup(this, 'ApplicationLogGroup', {
      logGroupName: NamingUtils.getLogGroupName('application', environment),
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Access log group for ALB logs
    this.accessLogGroup = new logs.LogGroup(this, 'AccessLogGroup', {
      logGroupName: NamingUtils.getLogGroupName('access', environment),
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  /**
   * Get application log group ARN
   */
  public getApplicationLogGroupArn(): string {
    return this.applicationLogGroup.logGroupArn;
  }

  /**
   * Get access log group ARN
   */
  public getAccessLogGroupArn(): string {
    return this.accessLogGroup.logGroupArn;
  }
}
