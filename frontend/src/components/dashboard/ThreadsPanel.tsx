/**
 * Threads Panel Component
 * Manages thread windows for a link
 * File size: ~185 lines
 */

import React, { useState, useEffect } from 'react';
import { ChatWindow } from '../aim-ui/ChatWindow';
import axios from 'axios';
import { awsConfig } from '../../config/aws-config';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import type { Thread } from '../../types';

interface ThreadsPanelProps {
  linkId: string;
  linkName: string;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
  onFocus?: () => void;
}

export const ThreadsPanel: React.FC<ThreadsPanelProps> = ({
  linkId,
  linkName,
  onClose,
  initialX,
  initialY,
  zIndex,
  onFocus,
}) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const { playFireExtinguish } = useAIMSounds();

  useEffect(() => {
    fetchThreads();
  }, [linkId]);

  const fetchThreads = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${awsConfig.api.baseUrl}/api/v1/dashboard/links/${linkId}/threads`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setThreads(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch threads:', error);
      setLoading(false);
    }
  };

  const handleSendMessage = async (threadId: string, message: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${awsConfig.api.baseUrl}/api/v1/dashboard/threads/${threadId}/reply`,
        { message },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchThreads();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleBurn = async (threadId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${awsConfig.api.baseUrl}/api/v1/dashboard/threads/${threadId}/burn`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      playFireExtinguish();
      await fetchThreads();
    } catch (error) {
      console.error('Failed to burn thread:', error);
      alert('Failed to burn thread.');
    }
  };

  if (loading) {
    return null;
  }

  // Show first thread (in real app, would handle multiple windows)
  const firstThread = threads[0];
  if (!firstThread) {
    return null;
  }

  return (
    <ChatWindow
      threadId={firstThread.thread_id}
      linkName={linkName}
      messages={firstThread.messages || []}
      onSendMessage={(msg) => handleSendMessage(firstThread.thread_id, msg)}
      onBurn={() => handleBurn(firstThread.thread_id)}
      onClose={onClose}
      initialX={initialX}
      initialY={initialY}
      zIndex={zIndex}
      onFocus={onFocus}
    />
  );
};
