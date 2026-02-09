/**
 * useAppSyncEvents Hook
 * Subscribes to an AppSync Events channel via native WebSocket.
 * Bypasses Amplify's events.connect() due to a bug where its subscribe
 * message includes extra fields that AppSync Events rejects.
 * No-ops gracefully when AppSync is not configured (env vars empty).
 */

import { useEffect, useRef } from 'react';
import { awsConfig } from '../config/aws-config';

const KEEPALIVE_BUFFER_MS = 5_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/** Shared singleton WebSocket connection across all hook instances */
let sharedSocket: WebSocket | null = null;
let socketReady = false;
let socketConnecting = false;
let keepAliveTimeoutId: ReturnType<typeof setTimeout> | undefined;
let connectionTimeoutMs = 300_000; // default 5 min, updated from connection_ack
let reconnectAttempt = 0;

// Listeners keyed by subscription id
const subscriptions = new Map<string, { channel: string; callback: (data: unknown) => void }>();
// Pending subscribes waiting for socket to be ready
const pendingSubscribes = new Set<string>();

function getWsUrl(): string {
  const { realtimeDns } = awsConfig.appSync;
  return `wss://${realtimeDns}/event/realtime`;
}

/** AWS date string in compact ISO format (required for API key auth) */
function getAmzDateString(): string {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getAuthHeaders(): Record<string, string> {
  const { httpDns, apiKey } = awsConfig.appSync;
  return {
    host: httpDns,
    'x-amz-date': getAmzDateString(),
    'x-api-key': apiKey,
  };
}

/**
 * Normalize channel path for AppSync Events.
 * - Ensures leading slash
 * - Replaces underscores with dashes (AppSync channels only allow [A-Za-z0-9-])
 *   Link IDs are base64url which includes underscores; UUIDs are unaffected.
 */
function normalizeChannel(channel: string): string {
  const withSlash = channel.startsWith('/') ? channel : `/${channel}`;
  return withSlash.replace(/_/g, '-');
}

function resetKeepAlive(timeoutMs: number): void {
  clearTimeout(keepAliveTimeoutId);
  keepAliveTimeoutId = setTimeout(() => {
    // Server missed keepalive — force reconnect
    sharedSocket?.close(4000, 'keepalive timeout');
  }, timeoutMs + KEEPALIVE_BUFFER_MS);
}

function sendSubscribe(subId: string, channel: string): void {
  if (!sharedSocket || sharedSocket.readyState !== WebSocket.OPEN || !socketReady) {
    pendingSubscribes.add(subId);
    return;
  }
  const normalized = normalizeChannel(channel);
  const msg = {
    type: 'subscribe',
    id: subId,
    channel: normalized,
    authorization: getAuthHeaders(),
  };
  sharedSocket.send(JSON.stringify(msg));
}

function sendUnsubscribe(subId: string): void {
  if (sharedSocket?.readyState === WebSocket.OPEN && socketReady) {
    sharedSocket.send(JSON.stringify({ type: 'unsubscribe', id: subId }));
  }
}

function flushPending(): void {
  for (const subId of pendingSubscribes) {
    const sub = subscriptions.get(subId);
    if (sub) sendSubscribe(subId, sub.channel);
  }
  pendingSubscribes.clear();
}

function scheduleReconnect(): void {
  const jitter = Math.random() * RECONNECT_BASE_MS;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS) + jitter;
  reconnectAttempt++;
  setTimeout(() => {
    if (subscriptions.size > 0) {
      // Re-subscribe all active subscriptions
      for (const subId of subscriptions.keys()) pendingSubscribes.add(subId);
      ensureConnection();
    }
  }, delay);
}

function ensureConnection(): void {
  if (sharedSocket?.readyState === WebSocket.OPEN || socketConnecting) return;

  const { realtimeDns, apiKey, httpDns } = awsConfig.appSync;
  if (!realtimeDns || !apiKey || !httpDns) return;

  socketConnecting = true;
  socketReady = false;

  const authHeader = JSON.stringify({
    host: httpDns,
    'x-amz-date': getAmzDateString(),
    'x-api-key': apiKey,
  });
  const encoded = btoa(authHeader)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const ws = new WebSocket(getWsUrl(), ['aws-appsync-event-ws', `header-${encoded}`]);
  sharedSocket = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'connection_init' }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data as string);

    switch (msg.type) {
      case 'connection_ack':
        socketReady = true;
        socketConnecting = false;
        reconnectAttempt = 0;
        connectionTimeoutMs = msg.connectionTimeoutMs || connectionTimeoutMs;
        resetKeepAlive(connectionTimeoutMs);
        flushPending();
        break;

      case 'ka':
        // Reset keepalive timer on every heartbeat using stored timeout
        resetKeepAlive(connectionTimeoutMs);
        break;

      case 'data': {
        const sub = subscriptions.get(msg.id);
        if (sub && msg.event) {
          try {
            sub.callback(JSON.parse(msg.event));
          } catch {
            sub.callback(msg.event);
          }
        }
        break;
      }

      case 'subscribe_success':
        pendingSubscribes.delete(msg.id);
        break;

      case 'subscribe_error': {
        const failedSub = subscriptions.get(msg.id);
        console.warn('AppSync subscribe error:', msg.errors, 'channel:', failedSub?.channel);
        pendingSubscribes.delete(msg.id);
        break;
      }

      case 'connection_error':
        console.warn('AppSync connection error:', msg.errors);
        break;
    }
  };

  ws.onclose = () => {
    clearTimeout(keepAliveTimeoutId);
    sharedSocket = null;
    socketReady = false;
    socketConnecting = false;
    if (subscriptions.size > 0) scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after onerror — reconnect handled there
  };
}

function cleanupIfEmpty(): void {
  if (subscriptions.size === 0 && sharedSocket) {
    clearTimeout(keepAliveTimeoutId);
    sharedSocket.close(1000, 'no subscriptions');
    sharedSocket = null;
    socketReady = false;
    socketConnecting = false;
  }
}

let subCounter = 0;

export function useAppSyncEvents(
  channel: string | null,
  onEvent: (data: unknown) => void
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channel || !awsConfig.appSync.realtimeDns) return;

    const subId = `sub-${++subCounter}`;
    subIdRef.current = subId;

    subscriptions.set(subId, {
      channel,
      callback: (data: unknown) => onEventRef.current(data),
    });

    ensureConnection();
    sendSubscribe(subId, channel);

    return () => {
      sendUnsubscribe(subId);
      subscriptions.delete(subId);
      pendingSubscribes.delete(subId);
      subIdRef.current = null;
      cleanupIfEmpty();
    };
  }, [channel]);
}
