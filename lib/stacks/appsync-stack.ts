/**
 * AppSync Events Stack
 * Creates AppSync Events API for real-time WebSocket pub/sub
 * File size: ~80 lines
 */

import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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
  public readonly publishFn: lambda.Function;

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

    // Channel namespace for room notifications
    // Channels: rooms/room/{room_id} - for key distribution events
    this.eventApi.addChannelNamespace('rooms');

    // Channel namespace for broadcast channel notifications
    // Channels: broadcast/channel/{channel_id} - new post events
    this.eventApi.addChannelNamespace('broadcast');

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

    // Lambda proxy for publishing events from NAT-free VPC.
    // The appsync-api VPC endpoint only supports private GraphQL APIs;
    // Events APIs are always public, so EC2 invokes this Lambda (via
    // Lambda VPC endpoint) which publishes to AppSync Events over the internet.
    this.publishFn = new lambda.Function(this, 'PublishFn', {
      functionName: NamingUtils.getResourceName('appsync-publish', environment),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        APPSYNC_HTTP_DOMAIN: this.httpDns,
        APPSYNC_API_KEY: this.apiKey,
      },
      code: lambda.Code.fromInline(`
const https = require('https');
exports.handler = async (event) => {
  const { channel, events } = event;
  const body = JSON.stringify({ channel, events });
  const options = {
    hostname: process.env.APPSYNC_HTTP_DOMAIN,
    path: '/event',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.APPSYNC_API_KEY,
      'content-length': Buffer.byteLength(body),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error('AppSync publish failed: ' + res.statusCode + ' ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};
      `.trim()),
    });

    new CfnOutput(this, 'PublishFnArn', {
      value: this.publishFn.functionArn,
      description: 'Lambda ARN for publishing AppSync Events from NAT-free VPC',
    });
  }

  /** Grant publish permission to an IAM role */
  grantPublish(grantee: iam.IGrantable): void {
    this.eventApi.grantPublish(grantee);
  }
}
