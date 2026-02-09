/**
 * AppSync Events Stack
 * Creates AppSync Events API for real-time WebSocket pub/sub
 * File size: ~80 lines
 */

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TagUtils } from '../utils/tags';
import { NamingUtils } from '../utils/naming';

export interface AppSyncStackProps extends StackProps {
  environment: string;
}

export class AppSyncStack extends Stack {
  public readonly httpDns: string;
  public readonly realtimeDns: string;
  public readonly apiKey: string;
  public readonly apiArn: string;
  public readonly eventApi: appsync.EventApi;

  constructor(scope: Construct, id: string, props: AppSyncStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Create Event API with dual auth:
    //   - IAM for backend publishing (EC2 instance role)
    //   - API_KEY for browser subscriptions (anonymous senders + dashboard)
    this.eventApi = new appsync.EventApi(this, 'EventApi', {
      apiName: NamingUtils.getResourceName('events', environment),
      authorizationConfig: {
        authProviders: [
          { authorizationType: appsync.AppSyncAuthorizationType.API_KEY },
          { authorizationType: appsync.AppSyncAuthorizationType.IAM },
        ],
        connectionAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        defaultPublishAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        defaultSubscribeAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
      },
    });

    // Channel namespace for message notifications
    // Channels: messages/thread/{thread_id}, messages/link/{link_id}
    this.eventApi.addChannelNamespace('messages');

    this.httpDns = this.eventApi.httpDns;
    this.realtimeDns = this.eventApi.realtimeDns;
    this.apiArn = this.eventApi.apiArn;

    // Extract API key value
    const defaultKey = this.eventApi.apiKeys['Default'];
    this.apiKey = defaultKey.attrApiKey;

    TagUtils.applyStandardTags(this, { environment });

    // Outputs
    new CfnOutput(this, 'HttpDns', {
      value: this.httpDns,
      description: 'AppSync Events HTTP endpoint for publishing',
    });

    new CfnOutput(this, 'RealtimeDns', {
      value: this.realtimeDns,
      description: 'AppSync Events WebSocket endpoint for subscriptions',
    });

    new CfnOutput(this, 'ApiKey', {
      value: this.apiKey,
      description: 'AppSync Events API key for browser auth',
    });

    new CfnOutput(this, 'ApiArn', {
      value: this.apiArn,
      description: 'AppSync Events API ARN',
    });
  }

  /** Grant publish permission to an IAM role */
  grantPublish(grantee: iam.IGrantable): void {
    this.eventApi.grantPublish(grantee);
  }
}
