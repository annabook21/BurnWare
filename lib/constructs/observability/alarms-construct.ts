/**
 * CloudWatch Alarms Construct
 * Creates all CloudWatch alarms with recommended thresholds
 * File size: ~270 lines
 */

import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as rds from 'aws-cdk-lib/aws-rds';
import { NamingUtils } from '../../utils/naming';
import { MONITORING_CONFIG } from '../../config/constants';

export interface AlarmsConstructProps {
  alb: elbv2.IApplicationLoadBalancer;
  targetGroup: elbv2.IApplicationTargetGroup;
  asg: autoscaling.IAutoScalingGroup;
  rdsInstance: rds.IDatabaseInstance;
  alarmTopic: sns.ITopic;
  environment: string;
}

export class AlarmsConstruct extends Construct {
  public readonly alarms: cloudwatch.Alarm[];

  constructor(scope: Construct, id: string, props: AlarmsConstructProps) {
    super(scope, id);

    const { alb, asg, alarmTopic, environment } = props;
    const targetGroup = props.targetGroup as elbv2.ApplicationTargetGroup;
    const rdsInstance = props.rdsInstance as rds.DatabaseInstance;

    this.alarms = [];

    // ALB 5xx Error Rate Alarm
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/amazon-rds-monitoring-alerting/cloudwatch-dashboards.html
    const alb5xxAlarm = new cloudwatch.Alarm(this, 'Alb5xxAlarm', {
      alarmName: NamingUtils.getAlarmName('alb-5xx', environment, 'high'),
      metric: new cloudwatch.MathExpression({
        expression: '(m1 / m2) * 100',
        usingMetrics: {
          m1: targetGroup.metricHttpCodeTarget(
            elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
            { statistic: 'Sum', period: Duration.minutes(5) }
          ),
          m2: targetGroup.metricRequestCount({ statistic: 'Sum', period: Duration.minutes(5) }),
        },
        label: '5xx Error Rate',
      }),
      threshold: 5,
      evaluationPeriods: MONITORING_CONFIG.alarmEvaluationPeriods,
      datapointsToAlarm: MONITORING_CONFIG.alarmDatapointsToAlarm,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    alb5xxAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(alb5xxAlarm);

    // ALB Unhealthy Hosts Alarm
    const unhealthyHostsAlarm = new cloudwatch.Alarm(this, 'UnhealthyHostsAlarm', {
      alarmName: NamingUtils.getAlarmName('alb-unhealthy', environment, 'hosts'),
      metric: targetGroup.metricUnhealthyHostCount({
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    unhealthyHostsAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(unhealthyHostsAlarm);

    // EC2 High CPU Alarm
    const ec2CpuAlarm = new cloudwatch.Alarm(this, 'Ec2CpuAlarm', {
      alarmName: NamingUtils.getAlarmName('ec2-cpu', environment, 'high'),
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          AutoScalingGroupName: asg.autoScalingGroupName,
        },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    ec2CpuAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(ec2CpuAlarm);

    // RDS CPU Alarm
    // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/monitoring-cloudwatch.html
    const rdsCpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      alarmName: NamingUtils.getAlarmName('rds-cpu', environment, 'high'),
      metric: rdsInstance.metricCPUUtilization({
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    rdsCpuAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(rdsCpuAlarm);

    // RDS Low Storage Alarm
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/amazon-rds-monitoring-alerting/cloudwatch-dashboards.html
    const rdsStorageAlarm = new cloudwatch.Alarm(this, 'RdsStorageAlarm', {
      alarmName: NamingUtils.getAlarmName('rds-storage', environment, 'low'),
      metric: rdsInstance.metricFreeStorageSpace({
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    rdsStorageAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(rdsStorageAlarm);

    // RDS High Connection Count Alarm
    const rdsConnectionsAlarm = new cloudwatch.Alarm(this, 'RdsConnectionsAlarm', {
      alarmName: NamingUtils.getAlarmName('rds-connections', environment, 'high'),
      metric: rdsInstance.metricDatabaseConnections({
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 80, // Adjust based on instance size max_connections
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    rdsConnectionsAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(rdsConnectionsAlarm);

    // ASG Insufficient Capacity Alarm
    const asgCapacityAlarm = new cloudwatch.Alarm(this, 'AsgCapacityAlarm', {
      alarmName: NamingUtils.getAlarmName('asg-capacity', environment, 'low'),
      metric: new cloudwatch.Metric({
        namespace: 'AWS/AutoScaling',
        metricName: 'GroupInServiceInstances',
        dimensionsMap: {
          AutoScalingGroupName: asg.autoScalingGroupName,
        },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 2,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      actionsEnabled: true,
    });
    asgCapacityAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
    this.alarms.push(asgCapacityAlarm);
  }

  /**
   * Get all alarm names
   */
  public getAlarmNames(): string[] {
    return this.alarms.map((alarm) => alarm.alarmName);
  }
}
