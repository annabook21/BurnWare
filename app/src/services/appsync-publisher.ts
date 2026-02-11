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

interface RoomKeyNeededEvent {
  room_id: string;
  participant_id: string;
  anonymous_id: string;
  display_name?: string;
  public_key: string;
  timestamp: number;
}

interface KeyDistributedEvent {
  room_id: string;
  participant_id: string;
  anonymous_id: string;
  timestamp: number;
}

interface RoomMessageEvent {
  room_id: string;
  message_id: string;
  anonymous_id: string;
  timestamp: number;
}

export class AppSyncPublisher {
  private _lambdaClient: LambdaClient | undefined;

  /** Lazy getter — env var may not be set at construction time (dotenv loads after imports). */
  private get publishFnArn(): string | undefined {
    return process.env.APPSYNC_PUBLISH_FN_ARN;
  }

  private get lambdaClient(): LambdaClient {
    if (!this._lambdaClient) {
      this._lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    }
    return this._lambdaClient;
  }

  private get enabled(): boolean {
    return !!this.publishFnArn;
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

  /**
   * Notify room creator that a participant needs their group key wrapped.
   * Used for auto-approve rooms where the server can't wrap keys (E2E).
   */
  async publishRoomKeyNeeded(
    roomId: string,
    participantId: string,
    anonymousId: string,
    publicKey: string,
    displayName?: string
  ): Promise<void> {
    if (!this.enabled) return;

    const event: RoomKeyNeededEvent = {
      room_id: roomId,
      participant_id: participantId,
      anonymous_id: anonymousId,
      public_key: publicKey,
      display_name: displayName,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(event);

    // Publish to room channel — creator's dashboard subscribes
    await this.publish(`/rooms/room/${this.channelSafe(roomId)}`, payload);
  }

  /**
   * Notify participant that their wrapped group key is ready.
   * Allows participant to stop polling and enter the room immediately.
   */
  async publishKeyDistributed(
    roomId: string,
    participantId: string,
    anonymousId: string
  ): Promise<void> {
    if (!this.enabled) return;

    const event: KeyDistributedEvent = {
      room_id: roomId,
      participant_id: participantId,
      anonymous_id: anonymousId,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(event);

    // Publish to participant-specific channel — joining participant subscribes
    await this.publish(`/rooms/participant/${this.channelSafe(anonymousId)}`, payload);
  }

  /**
   * Notify room participants that a new message was sent.
   * Allows real-time message updates without polling.
   */
  async publishRoomMessage(
    roomId: string,
    messageId: string,
    anonymousId: string
  ): Promise<void> {
    if (!this.enabled) return;

    const event: RoomMessageEvent = {
      room_id: roomId,
      message_id: messageId,
      anonymous_id: anonymousId,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(event);

    // Publish to room channel — all participants subscribe
    await this.publish(`/rooms/messages/${this.channelSafe(roomId)}`, payload);
  }

  private async publish(channel: string, eventPayload: string): Promise<void> {
    try {
      const command = new InvokeCommand({
        FunctionName: this.publishFnArn,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify({ channel, events: [eventPayload] })),
      });
      const result = await this.lambdaClient.send(command);

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
