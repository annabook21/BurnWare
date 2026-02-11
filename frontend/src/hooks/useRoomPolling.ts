/**
 * useRoomPolling Hook
 * Subscribes to room messages via AppSync Events with polling fallback.
 * AppSync provides near-instant message delivery; polling is a safety net.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { getRoomKey, RoomKeyData } from '../utils/key-store';
import { decryptGroupMessage } from '../utils/room-e2ee';
import { useAppSyncEvents } from './useAppSyncEvents';
import type { RoomMessage } from '../types';

interface DecryptedMessage extends RoomMessage {
  plaintext: string;
  isOwn: boolean;
}

interface UseRoomPollingResult {
  messages: DecryptedMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (plaintext: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRoomPolling(
  roomId: string,
  pollIntervalMs: number = 3000
): UseRoomPollingResult {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomKeys, setRoomKeys] = useState<RoomKeyData | null>(null);
  const lastCursorRef = useRef<{ time: string; messageId: string } | null>(null); // Cursor for pagination
  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false); // Prevent concurrent fetches
  const refetchPendingRef = useRef(false); // Queue refetch if one is in progress

  // Load room keys on mount
  useEffect(() => {
    const loadKeys = async () => {
      const keys = await getRoomKey(roomId);
      if (!isMountedRef.current) return;

      if (!keys) {
        setError('Room keys not found');
        setLoading(false);
        return;
      }
      setRoomKeys(keys);
    };

    loadKeys();

    return () => {
      isMountedRef.current = false;
    };
  }, [roomId]);

  // Fetch and decrypt messages using cursor-based pagination
  const fetchMessages = useCallback(async () => {
    if (!roomKeys) return;

    // Queue refetch if one is already in progress
    if (fetchingRef.current) {
      refetchPendingRef.current = true;
      return;
    }

    fetchingRef.current = true;
    refetchPendingRef.current = false;
    try {
      // Build URL with cursor (timestamp_messageId) for proper pagination
      const cursor = lastCursorRef.current;
      let url = `${endpoints.public.roomMessages(roomId)}?anonymous_id=${roomKeys.anonymousId}`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor.time)}_${cursor.messageId}`;
      }

      const response = await apiClient.get(url);
      const rawMessages: RoomMessage[] =
        response.data.data?.messages || response.data.data || [];

      if (rawMessages.length === 0) {
        if (!cursor) setLoading(false);
        return;
      }

      // Decrypt messages
      const decrypted: DecryptedMessage[] = await Promise.all(
        rawMessages.map(async (msg) => {
          try {
            const plaintext = await decryptGroupMessage(
              msg.ciphertext,
              msg.nonce,
              roomKeys.groupKey
            );
            return {
              ...msg,
              plaintext,
              isOwn: msg.anonymous_id === roomKeys.anonymousId,
            };
          } catch {
            return {
              ...msg,
              plaintext: '[Decryption failed]',
              isOwn: false,
            };
          }
        })
      );

      if (!isMountedRef.current) return;

      if (cursor) {
        // Append new messages (cursor-based pagination already ensures no duplicates)
        setMessages((prev) => [...prev, ...decrypted]);
      } else {
        // Initial load
        setMessages(decrypted);
      }

      // Update cursor to last message for next poll
      if (decrypted.length > 0) {
        const lastMsg = decrypted[decrypted.length - 1];
        lastCursorRef.current = {
          time: lastMsg.created_at,
          messageId: lastMsg.message_id,
        };
      }

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch room messages:', err);
      if (!isMountedRef.current) return;
      setError('Failed to load messages');
      setLoading(false);
    } finally {
      fetchingRef.current = false;
      // If a refetch was queued while we were fetching, run it now
      if (refetchPendingRef.current) {
        refetchPendingRef.current = false;
        void fetchMessages();
      }
    }
  }, [roomId, roomKeys]);

  // Subscribe to AppSync Events for real-time message notifications
  // When a new message event arrives, fetch immediately instead of waiting for poll
  const handleMessageEvent = useCallback(() => {
    // Event received means new message — trigger fetch immediately
    void fetchMessages();
  }, [fetchMessages]);

  // AppSync channel for room messages: /rooms/messages/{roomId}
  const messageChannel = roomKeys ? `rooms/messages/${roomId}` : null;
  useAppSyncEvents(messageChannel, handleMessageEvent);

  // Initial fetch and fallback polling (longer interval since we have AppSync)
  // Polling serves as safety net for missed events; AppSync is primary delivery
  const fallbackPollInterval = pollIntervalMs * 3; // 9s default (3x the original 3s)
  useEffect(() => {
    if (!roomKeys) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchMessages();
      if (!stopped) {
        timeoutId = setTimeout(poll, fallbackPollInterval);
      }
    };

    poll(); // Initial fetch
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [roomKeys, fetchMessages, fallbackPollInterval]);

  // Send message function
  const sendMessage = useCallback(
    async (plaintext: string) => {
      if (!roomKeys) {
        throw new Error('Room keys not loaded');
      }

      const { encryptGroupMessage } = await import('../utils/room-e2ee');
      const { ciphertext, nonce } = await encryptGroupMessage(
        plaintext,
        roomKeys.groupKey
      );

      await apiClient.post(endpoints.public.roomMessages(roomId), {
        anonymous_id: roomKeys.anonymousId,
        ciphertext,
        nonce,
      });

      // Fetch new messages immediately after sending
      await fetchMessages();
    },
    [roomId, roomKeys, fetchMessages]
  );

  const refresh = useCallback(async () => {
    await fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    refresh,
  };
}
