/**
 * AppSync Events Publisher
 * Publishes real-time notification events via a Lambda proxy.
 * The Lambda runs outside the VPC and calls AppSync Events HTTP API,
 * because the appsync-api VPC endpoint only supports private GraphQL APIs
 * (Events APIs are always public and unreachable from NAT-free VPCs).
 * Events carry only metadata (thread_id, link_id, sender_type) — never message content.
 * Gracefully no-ops when APPSYNC_PUBLISH_FN_ARN is not configured.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { logger } from '../config/logger';

interface MessageEvent {
  thread_id: string;
  link_id: string;
  sender_type: 'anonymous' | 'owner';
  timestamp: number;
}

let hasLoggedDisabled = false;

export class AppSyncPublisher {
  private lambdaClient: LambdaClient | undefined;
  private publishFnArn: string | undefined;

  constructor() {
    this.publishFnArn = process.env.APPSYNC_PUBLISH_FN_ARN;
    if (this.publishFnArn) {
      this.lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    } else if (!hasLoggedDisabled) {
      hasLoggedDisabled = true;
      logger.warn('AppSync Events disabled: APPSYNC_PUBLISH_FN_ARN not set. Real-time notifications will not be sent.');
    }
  }

  private get enabled(): boolean {
    return !!(this.publishFnArn && this.lambdaClient);
  }

  /** Replace underscores with dashes for AppSync Events channel compatibility.
   *  Channels only allow [A-Za-z0-9-]; link IDs are base64url which includes '_'. */
  private channelSafe(id: string): string {
    return id.replace(/_/g, '-');
  }

  async publishNewMessage(threadId: string, linkId: string, senderType: 'anonymous' | 'owner'): Promise<void> {
    if (!this.enabled) return;

    const event: MessageEvent = {
      thread_id: threadId,
      link_id: linkId,
      sender_type: senderType,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(event);

    // Publish to both channels concurrently:
    //   thread/{thread_id} — anonymous sender subscribes
    //   link/{link_id}     — dashboard owner subscribes
    await Promise.allSettled([
      this.publish(`/messages/thread/${this.channelSafe(threadId)}`, payload),
      this.publish(`/messages/link/${this.channelSafe(linkId)}`, payload),
    ]);
  }

  private async publish(channel: string, eventPayload: string): Promise<void> {
    try {
      const command = new InvokeCommand({
        FunctionName: this.publishFnArn,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify({ channel, events: [eventPayload] })),
      });
      const result = await this.lambdaClient!.send(command);

      if (result.FunctionError) {
        const errorPayload = result.Payload ? Buffer.from(result.Payload).toString() : 'unknown';
        logger.warn('AppSync publish Lambda error', { channel, error: errorPayload });
      } else {
        logger.debug('AppSync publish ok', { channel });
      }
    } catch (err) {
      logger.warn('AppSync publish error', { channel, error: (err as Error).message });
    }
  }
}
