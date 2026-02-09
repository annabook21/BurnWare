/**
 * AppSync Events Publisher
 * Publishes real-time notification events via AppSync Events HTTP API.
 * Events carry only metadata (thread_id, link_id, sender_type) — never message content.
 * Gracefully no-ops when APPSYNC_HTTP_DOMAIN is not configured.
 */

import { logger } from '../config/logger';

interface MessageEvent {
  thread_id: string;
  link_id: string;
  sender_type: 'anonymous' | 'owner';
  timestamp: number;
}

export class AppSyncPublisher {
  private httpDomain: string | undefined;
  private apiKey: string | undefined;

  constructor() {
    this.httpDomain = process.env.APPSYNC_HTTP_DOMAIN;
    this.apiKey = process.env.APPSYNC_API_KEY;
  }

  private get enabled(): boolean {
    return !!(this.httpDomain && this.apiKey);
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
      const res = await fetch(`https://${this.httpDomain}/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey!,
        },
        body: JSON.stringify({
          channel,
          events: [eventPayload],
        }),
      });

      if (!res.ok) {
        logger.warn('AppSync publish failed', { channel, status: res.status });
      }
    } catch (err) {
      logger.warn('AppSync publish error', { channel, error: (err as Error).message });
    }
  }
}
