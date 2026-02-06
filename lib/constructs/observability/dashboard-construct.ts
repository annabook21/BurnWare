/**
 * CloudWatch Dashboard Construct
 * Creates CloudWatch dashboard with key metrics
 * File size: ~240 lines
 */

import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as rds from 'aws-cdk-lib/aws-rds';
import { NamingUtils } from '../../utils/naming';

export interface DashboardConstructProps {
  alb: elbv2.IApplicationLoadBalancer;
  targetGroup: elbv2.IApplicationTargetGroup;
  asg: autoscaling.IAutoScalingGroup;
  rdsInstance: rds.IDatabaseInstance;
  environment: string;
}

export class DashboardConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: DashboardConstructProps) {
    super(scope, id);

    const { alb, asg, environment } = props;
    const targetGroup = props.targetGroup as elbv2.ApplicationTargetGroup;
    const rdsInstance = props.rdsInstance as rds.DatabaseInstance;

    // Create dashboard
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: NamingUtils.getResourceName('dashboard', environment),
    });

    // Overview Section
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Healthy Hosts',
        metrics: [
          targetGroup.metricHealthyHostCount({
            statistic: 'Average',
            period: Duration.minutes(5),
          }),
        ],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Total Requests (1h)',
        metrics: [
          targetGroup.metricRequestCount({
            statistic: 'Sum',
            period: Duration.hours(1),
          }),
        ],
        width: 6,
        height: 4,
      }),
      new cloudwatch.GraphWidget({
        title: 'Request Distribution by Status',
        left: [
          targetGroup.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_2XX_COUNT, {
            statistic: 'Sum',
            label: '2xx',
          }),
          targetGroup.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_4XX_COUNT, {
            statistic: 'Sum',
            label: '4xx',
          }),
          targetGroup.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
            statistic: 'Sum',
            label: '5xx',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Application Performance Section
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Response Time (p50, p95, p99)',
        left: [
          targetGroup.metricTargetResponseTime({
            statistic: 'p50',
            label: 'p50',
          }),
          targetGroup.metricTargetResponseTime({
            statistic: 'p95',
            label: 'p95',
          }),
          targetGroup.metricTargetResponseTime({
            statistic: 'p99',
            label: 'p99',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB Request Count & 5xx Errors',
        left: [
          targetGroup.metricRequestCount({
            statistic: 'Sum',
            label: 'Requests',
          }),
        ],
        right: [
          targetGroup.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
            statistic: 'Sum',
            label: '5xx Errors',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Infrastructure Health Section
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'EC2 CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              AutoScalingGroupName: asg.autoScalingGroupName,
            },
            statistic: 'Average',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ASG Healthy vs Desired Capacity',
        left: [
          targetGroup.metricHealthyHostCount({
            statistic: 'Average',
            label: 'Healthy',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/AutoScaling',
            metricName: 'GroupDesiredCapacity',
            dimensionsMap: {
              AutoScalingGroupName: asg.autoScalingGroupName,
            },
            statistic: 'Average',
            label: 'Desired',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Database Section
    // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/monitoring-cloudwatch.html
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU & Connections',
        left: [
          rdsInstance.metricCPUUtilization({
            statistic: 'Average',
            label: 'CPU %',
          }),
        ],
        right: [
          rdsInstance.metricDatabaseConnections({
            statistic: 'Average',
            label: 'Connections',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'RDS Free Storage (GB)',
        metrics: [
          rdsInstance.metricFreeStorageSpace({
            statistic: 'Average',
          }),
        ],
        width: 6,
        height: 4,
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS Read/Write Latency',
        left: [
          (rdsInstance as unknown as { metricReadLatency: (o?: object) => cloudwatch.IMetric }).metricReadLatency({
            statistic: 'Average',
            label: 'Read Latency',
          }),
          (rdsInstance as unknown as { metricWriteLatency: (o?: object) => cloudwatch.IMetric }).metricWriteLatency({
            statistic: 'Average',
            label: 'Write Latency',
          }),
        ],
        width: 12,
        height: 6,
      })
    );
  }

  /**
   * Get dashboard name
   */
  public getDashboardName(): string {
    return this.dashboard.dashboardName;
  }
}
