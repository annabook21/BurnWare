/**
 * Thread View Component
 * Shared inline thread viewer with polling — used by SendMessageWindow (post-send)
 * and ThreadPage (standalone bookmark view).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Button98 } from '../aim-ui/Button98';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import axios from 'axios';
import { decrypt } from '../../utils/e2ee';
import { getSenderKey, getAccessToken, getUnlockToken, saveUnlockToken } from '../../utils/key-store';
import type { Message } from '../../types/message';

interface ThreadViewProps {
  threadId: string;
  /** Compact mode hides the footer and constrains height (for embedding in windows) */
  compact?: boolean;
}

const POLL_INTERVAL_MS = 10000;

const MessageArea = styled.div<{ compact?: boolean }>`
  flex: 1;
  overflow-y: auto;
  padding: ${aimTheme.spacing.md};
  background: ${aimTheme.colors.white};
  box-shadow: var(--border-field);
  border: none;
  min-height: ${(p) => (p.compact ? '120px' : '200px')};
  max-height: ${(p) => (p.compact ? '260px' : '400px')};
`;

const MessageBubble = styled.div<{ isOwner: boolean }>`
  margin-bottom: ${aimTheme.spacing.md};
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  background: ${(p) => (p.isOwner ? '#E8F4FD' : '#F0F0F0')};
  border-left: 3px solid ${(p) => (p.isOwner ? aimTheme.colors.blue : aimTheme.colors.darkGray)};
  font-size: ${aimTheme.fonts.size.normal};
`;

const SenderLabel = styled.span<{ isOwner: boolean }>`
  font-weight: bold;
  color: ${(p) => (p.isOwner ? aimTheme.colors.blue : aimTheme.colors.darkGray)};
  font-size: ${aimTheme.fonts.size.small};
`;

const Timestamp = styled.span`
  color: ${aimTheme.colors.darkGray};
  font-size: ${aimTheme.fonts.size.tiny};
  margin-left: ${aimTheme.spacing.sm};
`;

const Footer = styled.div`
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  text-align: center;
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
`;

const StatusText = styled.p`
  color: ${aimTheme.colors.darkGray};
  font-style: italic;
`;

const PassphraseForm = styled.div`
  padding: ${aimTheme.spacing.md};
  text-align: center;
`;

const PassphraseInput = styled.input`
  border: none;
  padding: ${aimTheme.spacing.sm};
  width: 200px;
  margin-right: ${aimTheme.spacing.sm};
`;

function formatTime(iso: string | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export const ThreadView: React.FC<ThreadViewProps> = ({ threadId, compact = false }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [opsecState, setOpsecState] = useState<'ok' | 'expired' | 'access_denied' | 'passphrase_required'>('ok');
  const [passphrase, setPassphrase] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchThread = useCallback(async (signal?: AbortSignal) => {
    setFetchError(null);
    try {
      const headers: Record<string, string> = {};
      const accessToken = getAccessToken(threadId);
      const unlockToken = getUnlockToken(threadId);
      if (accessToken) headers['X-Access-Token'] = accessToken;
      if (unlockToken) headers['X-Unlock-Token'] = unlockToken;
      const res = await apiClient.get(endpoints.public.thread(threadId), { signal, headers });
      const data = res.data?.data;
      setOpsecState('ok');
      const msgList: Message[] = Array.isArray(data?.messages) ? data.messages : [];

      // E2EE: decrypt messages client-side using sender's ephemeral key
      const senderData = getSenderKey(threadId);
      let anonIndex = 0;
      for (const msg of msgList) {
        if (msg.sender_type === 'anonymous') {
          // Sender's own message — use cached plaintext (can't decrypt; encrypted with link's pub key)
          msg.content = senderData?.sentMessages[anonIndex] || '[Your message]';
          anonIndex++;
        } else if (msg.sender_type === 'owner' && senderData?.privateKeyJwk) {
          try {
            msg.content = await decrypt(msg.content, senderData.privateKeyJwk);
          } catch {
            msg.content = '[Unable to decrypt]';
          }
        } else if (msg.sender_type === 'owner') {
          msg.content = '[Key not available on this device]';
        }
      }

      setMessages(msgList);
      setNotFound(false);
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      const errResp = (err as { response?: { status?: number; data?: { error?: { code?: string } } } })?.response;
      const status = errResp?.status;
      const code = errResp?.data?.error?.code;
      if (status === 404) {
        setNotFound(true);
        setMessages([]);
      } else if (status === 410 || code === 'THREAD_EXPIRED') {
        setOpsecState('expired');
      } else if (status === 403 || code === 'ACCESS_DENIED') {
        setOpsecState('access_denied');
      } else if (status === 401 || code === 'PASSPHRASE_REQUIRED') {
        setOpsecState('passphrase_required');
      } else {
        setFetchError('Unable to load thread.');
      }
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  const handleUnlock = useCallback(async () => {
    if (!passphrase.trim()) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const headers: Record<string, string> = {};
      const accessToken = getAccessToken(threadId);
      if (accessToken) headers['X-Access-Token'] = accessToken;
      const res = await apiClient.post(endpoints.public.threadUnlock(threadId), { passphrase }, { headers });
      const token = res.data?.data?.unlock_token;
      if (token) {
        saveUnlockToken(threadId, token);
        setOpsecState('ok');
        setPassphrase('');
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setUnlockError(status === 401 ? 'Incorrect passphrase.' : 'Failed to unlock. Try again.');
    } finally {
      setUnlocking(false);
    }
  }, [threadId, passphrase]);

  // Recursive setTimeout polling (pause when OPSEC-blocked)
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchThread(controller.signal);
      if (!stopped && opsecState === 'ok') {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchThread, opsecState]);

  if (loading && messages.length === 0) {
    return (
      <MessageArea compact={compact}>
        <StatusText>Loading thread...</StatusText>
      </MessageArea>
    );
  }

  if (fetchError) {
    return (
      <MessageArea compact={compact}>
        <p style={{ color: aimTheme.colors.fireRed }}>{fetchError}</p>
      </MessageArea>
    );
  }

  if (notFound) {
    return (
      <MessageArea compact={compact}>
        <StatusText>This thread has been burned or no longer exists.</StatusText>
      </MessageArea>
    );
  }

  if (opsecState === 'expired') {
    return (
      <MessageArea compact={compact}>
        <StatusText>This thread has expired and self-destructed.</StatusText>
      </MessageArea>
    );
  }

  if (opsecState === 'access_denied') {
    return (
      <MessageArea compact={compact}>
        <StatusText>This thread is device-bound. Access from the original browser.</StatusText>
      </MessageArea>
    );
  }

  if (opsecState === 'passphrase_required') {
    return (
      <MessageArea compact={compact}>
        <PassphraseForm>
          <StatusText>This thread requires a passphrase to view.</StatusText>
          <div>
            <PassphraseInput
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter passphrase"
            />
            <Button98 onClick={handleUnlock} disabled={unlocking || !passphrase.trim()}>
              {unlocking ? 'Unlocking...' : 'Unlock'}
            </Button98>
          </div>
          {unlockError && <p style={{ color: aimTheme.colors.fireRed, marginTop: 8 }}>{unlockError}</p>}
        </PassphraseForm>
      </MessageArea>
    );
  }

  return (
    <>
      <MessageArea compact={compact}>
        {messages.length === 0 ? (
          <StatusText>No replies yet. Waiting for the recipient to reply...</StatusText>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.message_id} isOwner={msg.sender_type === 'owner'}>
              <div>
                <SenderLabel isOwner={msg.sender_type === 'owner'}>
                  {msg.sender_type === 'owner' ? 'Recipient' : 'You'}:
                </SenderLabel>
                <Timestamp>{formatTime(msg.created_at)}</Timestamp>
              </div>
              <div style={{ marginTop: 4 }}>{msg.content}</div>
            </MessageBubble>
          ))
        )}
        <div ref={messageEndRef} />
      </MessageArea>
      {!compact && (
        <Footer>Auto-refreshes every 10 seconds. Bookmark this page to check back later.</Footer>
      )}
    </>
  );
};
