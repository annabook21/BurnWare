/**
 * Threads Panel Component
 * Manages thread windows for a link
 */

import React, { useState, useEffect } from 'react';
import { ChatWindow } from '../aim-ui/ChatWindow';
import axios from 'axios';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { useAIMSounds } from '../../hooks/useAIMSounds';
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
  burned: boolean;
  messages: Message[];
}

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
  const { playFireExtinguish, playYouvGotMail } = useAIMSounds();
  const initialLoadRef = React.useRef(true);

  const fetchThreads = async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Step 1: Get thread list for this link
      const listResponse = await apiClient.get(
        endpoints.dashboard.threads(linkId),
        { headers, signal }
      );

      const threadList: { thread_id: string }[] = listResponse.data.data || [];

      // Step 2: Fetch messages for each thread
      const threadDetails = await Promise.all(
        threadList.map(async (t) => {
          const detailResponse = await apiClient.get(
            endpoints.dashboard.thread(t.thread_id),
            { headers, signal }
          );
          const data = detailResponse.data.data;
          return {
            thread_id: data.thread_id,
            link_id: data.link_id,
            burned: data.burned,
            messages: data.messages || [],
          } as ThreadData;
        })
      );

      const activeThreads = threadDetails.filter((t) => !t.burned);
      setThreads(activeThreads);
      if (initialLoadRef.current && activeThreads.length > 0) {
        playYouvGotMail();
        initialLoadRef.current = false;
      }
      setLoading(false);
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch threads:', error);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchThreads(controller.signal);
    return () => controller.abort();
  }, [linkId]);

  const handleSendMessage = async (threadId: string, message: string) => {
    try {
      const token = await getAccessToken();
      await apiClient.post(
        endpoints.dashboard.threadReply(threadId),
        { message },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

  if (loading) {
    return null;
  }

  if (threads.length === 0) {
    onClose();
    return null;
  }

  return (
    <>
      {threads.map((thread, index) => (
        <ChatWindow
          key={thread.thread_id}
          threadId={thread.thread_id}
          linkName={linkName}
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
