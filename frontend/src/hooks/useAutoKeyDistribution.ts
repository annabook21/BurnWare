/**
 * Auto Key Distribution Hook
 * Subscribes to AppSync Events for real-time key distribution requests.
 * Falls back to polling as a safety net (longer interval).
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { getAccessToken } from '../config/cognito-config';
import { getAllRoomKeys, RoomKeyData } from '../utils/key-store';
import { isVaultConfigured, isVaultUnlocked } from '../utils/key-vault';
import { wrapGroupKey } from '../utils/room-e2ee';
import { useAppSyncMultiChannelEvents } from './useAppSyncEvents';

interface KeyNeededEvent {
  room_id: string;
  participant_id: string;
  anonymous_id: string;
  display_name?: string;
  public_key: string;
  timestamp: number;
}

interface ParticipantNeedingKey {
  participant_id: string;
  anonymous_id: string;
  display_name?: string;
  public_key: string;
}

// Fallback polling interval (much longer since we have real-time events)
const FALLBACK_POLL_INTERVAL = 30000; // 30 seconds

const VAULT_NUDGE_TOAST_ID = 'vault-unlock-distribute';

export function useAutoKeyDistribution() {
  const pollingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vaultNudgeShownRef = useRef(false);
  const [roomKeys, setRoomKeys] = useState<Map<string, RoomKeyData>>(new Map());

  // Load room keys on mount and when vault state changes
  const loadRoomKeys = useCallback(async () => {
    try {
      const keys = await getAllRoomKeys();
      setRoomKeys(keys);

      // Subscribe to the first room (we'll cycle through them)
      if (keys.size === 0) {
        if (!vaultNudgeShownRef.current && (await isVaultConfigured()) && !isVaultUnlocked()) {
          vaultNudgeShownRef.current = true;
          toast.info('Unlock your vault to distribute keys to new participants.', { id: VAULT_NUDGE_TOAST_ID });
        }
      }
    } catch (err) {
      console.error('[AutoKeyDist] Failed to load room keys:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadRoomKeys();
  }, [loadRoomKeys]);

  // Build list of channels for all owned rooms
  const roomChannels = useMemo(() => {
    return Array.from(roomKeys.keys()).map((roomId) => `rooms/room/${roomId}`);
  }, [roomKeys]);

  // Handle real-time key needed event from AppSync
  const handleKeyNeededEvent = useCallback(async (data: unknown, _channel: string) => {
    const event = data as KeyNeededEvent;
    console.info('[AutoKeyDist] Real-time key request received:', event.room_id, event.participant_id);

    const keyData = roomKeys.get(event.room_id);
    if (!keyData) {
      console.debug('[AutoKeyDist] No keys for room, ignoring event');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) return;

      const publicKey = (event.public_key ?? '').trim();
      if (!publicKey) {
        console.error('[AutoKeyDist] Event has no public_key');
        toast.error('Key distribution failed: invalid participant key');
        return;
      }

      console.debug(`[AutoKeyDist] Wrapping key for ${event.participant_id}`);
      const wrappedKey = await wrapGroupKey(
        keyData.groupKey,
        keyData.privateKeyJwk,
        publicKey
      );

      await apiClient.post(
        endpoints.dashboard.roomSetKey(event.room_id, event.participant_id),
        { wrapped_group_key: wrappedKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.info(`[AutoKeyDist] Successfully distributed key to ${event.participant_id}`);
      toast.success(`Key distributed to ${event.display_name || 'participant'}`);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: unknown }; message?: string };
      console.error(`[AutoKeyDist] Failed to wrap/set key:`, error);
      toast.error(
        error.response?.data != null
          ? `Key distribution failed: ${JSON.stringify(error.response.data)}`
          : error.message ?? 'Key distribution failed'
      );
    }
  }, [roomKeys]);

  // Subscribe to AppSync Events for ALL owned rooms simultaneously
  // Uses multi-channel subscription to receive events from all rooms without cycling
  useAppSyncMultiChannelEvents(roomChannels, handleKeyNeededEvent);

  // Fallback polling (safety net for missed events)
  const distributeKeysFallback = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    try {
      const token = await getAccessToken();
      if (!token) return;

      const keys = await getAllRoomKeys();
      if (keys.size === 0) return;

      for (const [roomId, keyData] of keys) {
        await distributeKeysForRoom(roomId, keyData, token);
      }
    } catch (err) {
      console.debug('[AutoKeyDist] Fallback poll failed:', err);
    } finally {
      pollingRef.current = false;
    }
  }, []);

  // Fallback polling at longer interval
  useEffect(() => {
    const poll = () => {
      distributeKeysFallback();
      timeoutRef.current = setTimeout(poll, FALLBACK_POLL_INTERVAL);
    };

    // Start after initial delay to let AppSync connect first
    timeoutRef.current = setTimeout(poll, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [distributeKeysFallback]);
}

async function distributeKeysForRoom(
  roomId: string,
  keyData: RoomKeyData,
  token: string
): Promise<void> {
  try {
    const response = await apiClient.get(endpoints.dashboard.roomNeedsKeys(roomId), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const participants: ParticipantNeedingKey[] =
      response.data?.data?.participants ?? response.data?.participants ?? [];
    if (participants.length === 0) return;

    for (const participant of participants) {
      try {
        const publicKey = (participant.public_key ?? '').trim();
        if (!publicKey) {
          console.error(`[AutoKeyDist] Participant ${participant.participant_id} has no public_key`);
          continue;
        }
        const wrappedKey = await wrapGroupKey(
          keyData.groupKey,
          keyData.privateKeyJwk,
          publicKey
        );

        await apiClient.post(
          endpoints.dashboard.roomSetKey(roomId, participant.participant_id),
          { wrapped_group_key: wrappedKey },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.debug(`[AutoKeyDist] Fallback: distributed key to ${participant.participant_id}`);
      } catch (wrapErr) {
        console.error(`[AutoKeyDist] Failed to wrap/set key for ${participant.participant_id}:`, wrapErr);
      }
    }
  } catch (err) {
    console.debug(`[AutoKeyDist] Room ${roomId} check failed:`, err);
  }
}
