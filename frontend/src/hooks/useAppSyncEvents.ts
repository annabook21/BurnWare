/**
 * useAppSyncEvents Hook
 * Subscribes to an AppSync Events channel for real-time notifications.
 * No-ops gracefully when AppSync is not configured (env vars empty).
 */

import { useEffect, useRef } from 'react';
import { events } from 'aws-amplify/data';
import { awsConfig } from '../config/aws-config';

export function useAppSyncEvents(
  channel: string | null,
  onEvent: (data: unknown) => void
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!channel || !awsConfig.appSync.httpDns) return;

    let closed = false;
    let sub: { close: () => void } | undefined;

    (async () => {
      try {
        const ch = await events.connect(channel);
        if (closed) {
          ch.close();
          return;
        }
        sub = ch;
        ch.subscribe({
          next: (event: { event: unknown }) => onEventRef.current(event.event),
          error: (err: unknown) => console.warn('AppSync subscription error:', err),
        });
      } catch (err) {
        console.warn('AppSync connect error:', err);
      }
    })();

    return () => {
      closed = true;
      sub?.close();
    };
  }, [channel]);
}
