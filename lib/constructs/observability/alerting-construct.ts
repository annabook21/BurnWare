/**
 * Alerting Construct
 * Creates SNS topic for alarm notifications
 * File size: ~95 lines
 */

import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { NamingUtils } from '../../utils/naming';

export interface AlertingConstructProps {
  environment: string;
  alarmEmail: string;
}

export class AlertingConstruct extends Construct {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlertingConstructProps) {
    super(scope, id);

    const { environment, alarmEmail } = props;

    // Create SNS topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: NamingUtils.getResourceName('alerts', environment),
      displayName: `BurnWare Alerts - ${environment}`,
    });

    // Add email subscription
    this.alarmTopic.addSubscription(new subscriptions.EmailSubscription(alarmEmail));
  }

  /**
   * Get topic ARN
   */
  public getTopicArn(): string {
    return this.alarmTopic.topicArn;
  }

  /**
   * Add additional email subscription
   */
  public addEmailSubscription(email: string): void {
    this.alarmTopic.addSubscription(new subscriptions.EmailSubscription(email));
  }

  /**
   * Add Lambda subscription for custom handling (e.g., Slack, PagerDuty)
   */
  public addLambdaSubscription(lambdaArn: string): void {
    // Lambda subscription would be added here
    // Not implemented in this version
  }
}
