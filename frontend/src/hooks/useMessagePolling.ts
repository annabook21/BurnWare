/**
 * Message Polling Hook
 * Real-time message notifications via AppSync Events with polling fallback.
 *
 * Architecture (per AWS AppSync best practices):
 * - Primary: AppSync WebSocket subscription for instant notifications
 * - Fallback: Long-interval polling as safety net for missed events
 * - Connection-aware: Pauses when tab is hidden to save resources
 *
 * @see https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { getAccessToken } from '../config/cognito-config';
import { useAppSyncMultiChannelEvents } from './useAppSyncEvents';
import type { Link } from '../types';

// Fallback polling intervals (much longer since AppSync is primary)
const FALLBACK_POLL_INTERVAL_MS = 60_000; // 60s fallback poll
const INITIAL_LOAD_DELAY_MS = 100; // Quick initial load

interface MessagePollingResult {
  links: Link[];
  loading: boolean;
  newMessageLinkIds: Set<string>;
  acknowledgeLink: (linkId: string) => void;
  refreshLinks: () => Promise<void>;
}

export const useMessagePolling = (): MessagePollingResult => {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessageLinkIds, setNewMessageLinkIds] = useState<Set<string>>(new Set());
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);

  // Track link IDs for AppSync subscriptions
  const linkIdsRef = useRef<string[]>([]);

  // Fetch full link data
  const fetchLinks = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.links(), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const fetchedLinks: Link[] = response.data.data || [];
      setLinks(fetchedLinks);
      setLoading(false);

      // Update link IDs for subscriptions
      linkIdsRef.current = fetchedLinks.map((l) => l.link_id);
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch links:', error);
        setLoading(false);
      }
    }
  }, []);

  // Handle real-time message event from AppSync
  const handleMessageEvent = useCallback((data: unknown, channel: string) => {
    // Extract link_id from event payload (preferred — the backend includes the original
    // unsanitized link_id in every MessageEvent). Avoids lossy channel name reversal
    // where replace(/-/g, '_') would corrupt IDs that naturally contain dashes.
    let linkId: string | undefined;
    if (data && typeof data === 'object' && 'link_id' in data) {
      linkId = (data as { link_id: string }).link_id;
    }
    if (!linkId) {
      // Fallback: extract from channel (best-effort, may not match original ID exactly)
      linkId = channel.split('/').pop();
    }
    if (!linkId) return;

    console.info('[MessagePolling] Real-time message event for link:', linkId);

    // Mark link as having new messages
    setNewMessageLinkIds((prev) => {
      if (prev.has(linkId)) return prev;
      const next = new Set(prev);
      next.add(linkId);
      return next;
    });

    // Refresh link data to get updated counts
    void fetchLinks();
  }, [fetchLinks]);

  // Build AppSync channels for all owned links
  const channels = linkIdsRef.current.map(
    (id) => `messages/link/${id.replace(/_/g, '-')}`
  );

  // Subscribe to all link channels via AppSync (primary real-time delivery)
  // Per AWS best practices: use multi-channel subscription to reduce overhead
  useAppSyncMultiChannelEvents(
    isTabVisible ? channels : [], // Disconnect when tab hidden (battery/resource saving)
    handleMessageEvent
  );

  // Track tab visibility for connection management
  // Per AWS best practices: disconnect when backgrounded, reconnect when active
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
      // Refresh on tab return to catch any missed events
      if (!document.hidden) {
        void fetchLinks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchLinks]);

  const acknowledgeLink = useCallback((linkId: string) => {
    setNewMessageLinkIds((prev) => {
      if (!prev.has(linkId)) return prev;
      const next = new Set(prev);
      next.delete(linkId);
      return next;
    });
  }, []);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchLinks(controller.signal);
    }, INITIAL_LOAD_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchLinks]);

  // Fallback polling (safety net for missed AppSync events)
  // Per AWS best practices: keep polling as fallback but at much longer intervals
  useEffect(() => {
    if (!isTabVisible) return; // Don't poll when hidden

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      await fetchLinks(controller.signal);
      if (!stopped) {
        timeoutId = setTimeout(poll, FALLBACK_POLL_INTERVAL_MS);
      }
    };

    // Start fallback polling after initial delay
    timeoutId = setTimeout(poll, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchLinks, isTabVisible]);

  const refreshLinks = useCallback(() => fetchLinks(), [fetchLinks]);

  return { links, loading, newMessageLinkIds, acknowledgeLink, refreshLinks };
};
