/**
 * Threads Panel Component
 * Manages thread windows for a link
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChatWindow } from '../aim-ui/ChatWindow';
import axios from 'axios';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import { decrypt, encrypt } from '../../utils/e2ee';
import { getLinkKey, getReplyPlaintexts, saveReplyPlaintext } from '../../utils/key-store';
import { KeyRecoveryDialog } from './KeyRecoveryDialog';
import { useAppSyncEvents } from '../../hooks/useAppSyncEvents';
import type { Message } from '../../types';

interface ThreadsPanelProps {
  linkId: string;
  linkName: string;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
  onFocus?: () => void;
}

interface ThreadData {
  thread_id: string;
  link_id: string;
  sender_anonymous_id: string;
  sender_public_key?: string;
  burned: boolean;
  messages: Message[];
}

const POLL_INTERVAL_MS = 30000; // Fallback only; AppSync Events provides instant updates

export const ThreadsPanel: React.FC<ThreadsPanelProps> = ({
  linkId,
  linkName,
  onClose,
  initialX = 320,
  initialY = 50,
  zIndex,
  onFocus,
}) => {
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const fetchOkRef = React.useRef(false);
  const { playFireExtinguish, playMessageSend } = useAIMSounds();
  const prevMessageCountRef = React.useRef<number | null>(null);

  const fetchThreads = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Step 1: Get thread list for this link
      const listResponse = await apiClient.get(
        endpoints.dashboard.threads(linkId),
        { headers, signal }
      );

      const threadList: { thread_id: string }[] = listResponse.data.data || [];

      // Step 2: Fetch messages for each thread (partial failure tolerant)
      const results = await Promise.allSettled(
        threadList.map(async (t) => {
          const detailResponse = await apiClient.get(
            endpoints.dashboard.thread(t.thread_id),
            { headers, signal }
          );
          const data = detailResponse.data.data;
          return {
            thread_id: data.thread_id,
            link_id: data.link_id,
            sender_anonymous_id: data.sender_anonymous_id || data.thread_id?.slice(0, 8) || 'anon',
            sender_public_key: data.sender_public_key,
            burned: data.burned,
            messages: data.messages || [],
          } as ThreadData;
        })
      );

      const threadDetails = results
        .filter((r): r is PromiseFulfilledResult<ThreadData> => r.status === 'fulfilled')
        .map((r) => r.value);

      const activeThreads = threadDetails.filter((t) => !t.burned);

      // E2EE: decrypt messages client-side
      const linkKey = await getLinkKey(linkId);
      if (!linkKey && activeThreads.some((t) => t.messages.length > 0)) {
        // Key missing — check if server has a backup
        try {
          const token = await getAccessToken();
          const backupRes = await apiClient.get(
            endpoints.dashboard.keyBackup(linkId),
            { headers: { Authorization: `Bearer ${token}` }, signal },
          );
          if (backupRes.data?.data) setNeedsRecovery(true);
        } catch {
          // No backup available — nothing to recover
        }
      }
      for (const thread of activeThreads) {
        const replyCache = await getReplyPlaintexts(thread.thread_id);
        for (const msg of thread.messages) {
          if (msg.sender_type === 'anonymous' && linkKey) {
            try {
              msg.content = await decrypt(msg.content, linkKey);
            } catch {
              msg.content = '[Unable to decrypt]';
            }
          } else if (msg.sender_type === 'anonymous' && !linkKey) {
            msg.content = '[Key missing — recovery required]';
          } else if (msg.sender_type === 'owner') {
            msg.content = replyCache[msg.message_id] || '[Your reply]';
          }
        }
      }

      // Detect new messages by comparing total message count
      const totalMessages = activeThreads.reduce((sum, t) => sum + t.messages.length, 0);
      if (prevMessageCountRef.current !== null && totalMessages > prevMessageCountRef.current) {
        playMessageSend(); // IM receive sound
      }
      prevMessageCountRef.current = totalMessages;

      setThreads(activeThreads);
      fetchOkRef.current = true;
      setLoading(false);
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch threads:', error);
        setLoading(false);
      }
    }
  }, [linkId, playMessageSend]);

  // Recursive setTimeout polling: avoids overlapping requests unlike setInterval
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchThreads(controller.signal);
      if (!stopped) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll(); // initial fetch
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchThreads]);

  // Real-time: subscribe to link channel for instant updates
  useAppSyncEvents(
    `messages/link/${linkId}`,
    useCallback(() => { fetchThreads(); }, [fetchThreads])
  );

  // In classic AIM, closing IM windows is explicit (user clicks X).
  // No auto-close on empty threads.

  const handleSendMessage = async (threadId: string, message: string) => {
    try {
      const thread = threads.find((t) => t.thread_id === threadId);
      const token = await getAccessToken();
      let body: Record<string, string>;

      if (thread?.sender_public_key) {
        // E2EE: encrypt reply with sender's public key
        const { ciphertext } = await encrypt(message, thread.sender_public_key);
        body = { ciphertext };
      } else {
        // Legacy plaintext reply (thread has no sender key)
        body = { message };
      }

      const res = await apiClient.post(
        endpoints.dashboard.threadReply(threadId),
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Cache plaintext so owner can read their own reply
      const messageId = res.data?.data?.message_id;
      if (messageId) {
        await saveReplyPlaintext(threadId, messageId, message);
      }

      await fetchThreads();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const handleBurn = async (threadId: string) => {
    try {
      const token = await getAccessToken();
      await apiClient.post(
        endpoints.dashboard.threadBurn(threadId),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      playFireExtinguish();
      await fetchThreads();
    } catch (error) {
      console.error('Failed to burn thread:', error);
      toast.error('Failed to burn thread.');
    }
  };

  const handleRecoveryComplete = useCallback(() => {
    setNeedsRecovery(false);
    fetchThreads();
  }, [fetchThreads]);

  if (loading) {
    return null;
  }

  if (threads.length === 0) {
    // No threads yet — show a single placeholder ChatWindow
    return (
      <ChatWindow
        threadId={`empty-${linkId}`}
        linkName={linkName}
        senderAnonymousId=""
        messages={[]}
        onSendMessage={() => Promise.resolve()}
        onBurn={() => Promise.resolve()}
        onClose={onClose}
        initialX={initialX}
        initialY={initialY}
        zIndex={zIndex}
        onFocus={onFocus}
      />
    );
  }

  return (
    <>
      {needsRecovery && (
        <KeyRecoveryDialog
          linkId={linkId}
          linkName={linkName}
          onRecovered={handleRecoveryComplete}
          onClose={() => setNeedsRecovery(false)}
        />
      )}
      {threads.map((thread, index) => (
        <ChatWindow
          key={thread.thread_id}
          threadId={thread.thread_id}
          linkName={linkName}
          senderAnonymousId={thread.sender_anonymous_id}
          messages={thread.messages}
          onSendMessage={(msg) => handleSendMessage(thread.thread_id, msg)}
          onBurn={() => handleBurn(thread.thread_id)}
          onClose={onClose}
          initialX={initialX + index * 30}
          initialY={initialY + index * 30}
          zIndex={zIndex ? zIndex + index : undefined}
          onFocus={onFocus}
        />
      ))}
    </>
  );
};
