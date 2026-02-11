/**
 * useAppSyncEvents Hook
 * Subscribes to an AppSync Events channel via native WebSocket.
 * Bypasses Amplify's events.connect() due to a bug where its subscribe
 * message includes extra fields that AppSync Events rejects.
 * No-ops gracefully when AppSync is not configured (env vars empty).
 *
 * Optimizations (per AWS AppSync Events best practices):
 * - Single shared WebSocket for all subscriptions to reduce connection overhead
 * - Jittered exponential backoff on reconnect
 * - Keepalive tracking; close if no "ka" within connectionTimeoutMs
 * - Debounced event callback to avoid refetch storms when events arrive in quick succession
 */

import { useEffect, useRef } from 'react';
import { awsConfig } from '../config/aws-config';

const KEEPALIVE_BUFFER_MS = 5_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/** Debounce rapid events so one refetch covers a burst (e.g. multiple messages in <300ms) */
const EVENT_DEBOUNCE_MS = 280;

/** Shared singleton WebSocket connection across all hook instances */
let sharedSocket: WebSocket | null = null;
let socketReady = false;
let socketConnecting = false;
let keepAliveTimeoutId: ReturnType<typeof setTimeout> | undefined;
let connectionTimeoutMs = 300_000; // default 5 min, updated from connection_ack
let reconnectAttempt = 0;
let hasLoggedNotConfigured = false;
let hasLoggedConnected = false;
let hasLoggedEvent = false;

interface SubEntry {
  channel: string;
  callback: (data: unknown) => void;
  cancel?: () => void;
}
const subscriptions = new Map<string, SubEntry>();
// Pending subscribes waiting for socket to be ready
const pendingSubscribes = new Set<string>();

function getWsUrl(): string {
  const { realtimeDns } = awsConfig.appSync;
  return `wss://${realtimeDns}/event/realtime`;
}

/** Auth for WebSocket connection handshake (subprotocol) and for subscribe messages. API key format per AWS docs: host + x-api-key only. */
function getConnectionAuth(): Record<string, string> {
  const { httpDns, apiKey } = awsConfig.appSync;
  return { host: httpDns, 'x-api-key': apiKey };
}

function getAuthHeaders(): Record<string, string> {
  return getConnectionAuth();
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

/**
 * Debounced invoker: waits delayMs after the last call before invoking fn.
 * Returns a function with .cancel() to clear any pending invocation.
 */
function debounce<T>(fn: (arg: T) => void, delayMs: number): ((arg: T) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const debounced = (arg: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      fn(arg);
    }, delayMs);
  };
  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };
  return debounced;
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
  if (!realtimeDns || !apiKey || !httpDns) {
    if (!hasLoggedNotConfigured) {
      hasLoggedNotConfigured = true;
      console.warn(
        '[BurnWare] Real-time disabled: AppSync not configured. Set VITE_APPSYNC_REALTIME_DOMAIN, VITE_APPSYNC_HTTP_DOMAIN, VITE_APPSYNC_API_KEY in frontend/.env for local dev, or ensure runtime-config.json is deployed (CDK Frontend stack).'
      );
    }
    return;
  }

  socketConnecting = true;
  socketReady = false;
  hasLoggedConnected = false;

  const authHeader = JSON.stringify(getConnectionAuth());
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
        if (!hasLoggedConnected) {
          hasLoggedConnected = true;
          console.info('[BurnWare] Real-time connected (AppSync Events)');
        }
        flushPending();
        break;

      case 'ka':
        // Reset keepalive timer on every heartbeat using stored timeout
        resetKeepAlive(connectionTimeoutMs);
        break;

      case 'data': {
        const sub = subscriptions.get(msg.id);
        if (!sub) break;

        if (!hasLoggedEvent) {
          hasLoggedEvent = true;
          console.info('[BurnWare] Real-time event received — UI will refresh');
        }

        // AppSync Events sends event as a JSON string or array of JSON strings
        const events = Array.isArray(msg.event) ? msg.event : [msg.event];
        for (const e of events) {
          if (e == null) continue;
          if (typeof e === 'string') {
            try { sub.callback(JSON.parse(e)); }
            catch { sub.callback(e); }
          } else {
            sub.callback(e);
          }
        }
        break;
      }

      case 'subscribe_success': {
        pendingSubscribes.delete(msg.id);
        const sub = subscriptions.get(msg.id);
        if (import.meta.env.DEV && sub) {
          console.info('[BurnWare] Subscribed to', sub.channel);
        }
        break;
      }

      case 'subscribe_error': {
        const failedSub = subscriptions.get(msg.id);
        console.warn('AppSync subscribe error:', msg.errors, 'channel:', failedSub?.channel);
        pendingSubscribes.delete(msg.id);
        break;
      }

      case 'broadcast_error': {
        const sub = subscriptions.get(msg.id);
        console.warn('AppSync broadcast error:', msg.errors, 'channel:', sub?.channel);
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
    const { realtimeDns } = awsConfig.appSync;
    if (!channel || !realtimeDns) return;

    const subId = `sub-${++subCounter}`;
    subIdRef.current = subId;

    const debouncedOnEvent = debounce((data: unknown) => onEventRef.current(data), EVENT_DEBOUNCE_MS);
    subscriptions.set(subId, {
      channel,
      callback: debouncedOnEvent,
      cancel: () => debouncedOnEvent.cancel(),
    });

    ensureConnection();
    sendSubscribe(subId, channel);

    return () => {
      const sub = subscriptions.get(subId);
      sub?.cancel?.();
      sendUnsubscribe(subId);
      subscriptions.delete(subId);
      pendingSubscribes.delete(subId);
      subIdRef.current = null;
      cleanupIfEmpty();
    };
  }, [channel]);
}

/**
 * Subscribe to multiple AppSync Events channels simultaneously.
 * Each channel shares the same WebSocket connection and callback.
 * Channels are identified by the callback receiving events from all.
 */
export function useAppSyncMultiChannelEvents(
  channels: string[],
  onEvent: (data: unknown, channel: string) => void
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const subIdsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const { realtimeDns } = awsConfig.appSync;
    if (!realtimeDns || channels.length === 0) return;

    const currentSubIds = new Map<string, string>();
    const existingSubIds = subIdsRef.current;

    // Add subscriptions for new channels
    for (const channel of channels) {
      // Reuse existing subscription if channel already subscribed
      if (existingSubIds.has(channel)) {
        const existingSubId = existingSubIds.get(channel)!;
        currentSubIds.set(channel, existingSubId);
        continue;
      }

      const subId = `sub-${++subCounter}`;
      currentSubIds.set(channel, subId);

      const debouncedOnEvent = debounce(
        (data: unknown) => onEventRef.current(data, channel),
        EVENT_DEBOUNCE_MS
      );
      subscriptions.set(subId, {
        channel,
        callback: debouncedOnEvent,
        cancel: () => debouncedOnEvent.cancel(),
      });

      ensureConnection();
      sendSubscribe(subId, channel);
    }

    // Remove subscriptions for channels no longer needed
    for (const [channel, subId] of existingSubIds) {
      if (!currentSubIds.has(channel)) {
        const sub = subscriptions.get(subId);
        sub?.cancel?.();
        sendUnsubscribe(subId);
        subscriptions.delete(subId);
        pendingSubscribes.delete(subId);
      }
    }

    subIdsRef.current = currentSubIds;

    return () => {
      for (const [, subId] of currentSubIds) {
        const sub = subscriptions.get(subId);
        sub?.cancel?.();
        sendUnsubscribe(subId);
        subscriptions.delete(subId);
        pendingSubscribes.delete(subId);
      }
      subIdsRef.current = new Map();
      cleanupIfEmpty();
    };
  }, [channels.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
}
