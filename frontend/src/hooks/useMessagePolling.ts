/**
 * Message Polling Hook
 * Fast polling for new message detection + slow polling for full link data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { getAccessToken } from '../config/cognito-config';
import type { Link } from '../types';

const COUNTS_INTERVAL_MS = 10_000; // 10s — lightweight
const LINKS_INTERVAL_MS = 30_000; // 30s — full metadata

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

  // Baseline counts — first poll sets this, subsequent polls compare against it
  const baselineCounts = useRef<Map<string, number> | null>(null);

  const fetchLinks = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.links(), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      setLinks(response.data.data || []);
      setLoading(false);
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch links:', error);
        setLoading(false);
      }
    }
  }, []);

  const fetchCounts = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.linkCounts(), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      const counts: { link_id: string; message_count: number }[] = response.data.data || [];
      const countMap = new Map(counts.map((c) => [c.link_id, c.message_count]));

      if (!baselineCounts.current) {
        // First poll — establish baseline, no false triggers
        baselineCounts.current = countMap;
        return;
      }

      // Compare to baseline — any link with increased count has new messages
      const newIds = new Set<string>();
      for (const [linkId, count] of countMap) {
        const baseline = baselineCounts.current.get(linkId) ?? 0;
        if (count > baseline) {
          newIds.add(linkId);
        }
      }

      if (newIds.size > 0) {
        setNewMessageLinkIds((prev) => {
          const merged = new Set(prev);
          for (const id of newIds) merged.add(id);
          return merged;
        });
        // Update baseline so we don't re-trigger for the same messages
        baselineCounts.current = countMap;
        // Also refresh full link data so BuddyList shows updated counts
        // (don't await — fire and forget so counts poll stays fast)
        fetchLinks();
      }
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch counts:', error);
      }
    }
  }, [fetchLinks]);

  const acknowledgeLink = useCallback((linkId: string) => {
    setNewMessageLinkIds((prev) => {
      if (!prev.has(linkId)) return prev;
      const next = new Set(prev);
      next.delete(linkId);
      return next;
    });
  }, []);

  // Full links poll (slow — 30s)
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchLinks(controller.signal);
      if (!stopped) timeoutId = setTimeout(poll, LINKS_INTERVAL_MS);
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchLinks]);

  // Counts poll (fast — 10s)
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchCounts(controller.signal);
      if (!stopped) timeoutId = setTimeout(poll, COUNTS_INTERVAL_MS);
    };

    // Delay first counts poll slightly so links load first
    timeoutId = setTimeout(poll, 2000);
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchCounts]);

  return { links, loading, newMessageLinkIds, acknowledgeLink, refreshLinks: fetchLinks };
};
