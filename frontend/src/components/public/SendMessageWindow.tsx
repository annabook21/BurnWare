/**
 * Send Message Window Component
 * Anonymous message sending interface (AIM style).
 * After the first message, transforms into a live ChatWindow-style conversation.
 * File size: ~310 lines
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import axios from 'axios';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { encrypt, decrypt } from '../../utils/e2ee';
import { saveSenderKey, getSenderKey, addSentMessage, saveAccessToken, getAccessToken } from '../../utils/key-store';
import { useAppSyncEvents } from '../../hooks/useAppSyncEvents';
import type { Message } from '../../types';

interface SendMessageWindowProps {
  linkId: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
`;

const InfoSection = styled.div`
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  background: linear-gradient(to bottom, #FFFFFF, #F0F0F0);
  border-bottom: 1px solid ${aimTheme.colors.darkGray};
`;

const LinkTitle = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  font-size: ${aimTheme.fonts.size.medium};
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
`;

const Description = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: #666;
  font-style: italic;
`;

const ComposeSection = styled.div`
  flex: 1;
  padding: ${aimTheme.spacing.md};
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.sm};
`;

const ComposeTextArea = styled.textarea`
  flex: 1;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.md};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  resize: none;
  background: ${aimTheme.colors.white};
  &:focus { outline: none; }
`;

const PrivacyNote = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
  font-style: italic;
  margin: ${aimTheme.spacing.sm} 0;
  padding: ${aimTheme.spacing.sm};
  background: #FFFFCC;
  border: 1px solid #E0E000;
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  justify-content: center;
  margin-top: ${aimTheme.spacing.md};
`;

const AIMButton = styled.button`
  padding: 4px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: bold;
  cursor: pointer;
  &:active { border-style: inset; }
  &:disabled { color: ${aimTheme.colors.darkGray}; cursor: not-allowed; }
`;

// ── Live chat styles (post-send) ──

const MessageArea = styled.div`
  flex: 1;
  background: ${aimTheme.colors.white};
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.md};
  overflow-y: auto;
  margin: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
`;

const MessageBubble = styled.div`
  margin: ${aimTheme.spacing.sm} 0;
  padding: ${aimTheme.spacing.sm} 0;
  word-wrap: break-word;
`;

const Timestamp = styled.span`
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
  margin-right: ${aimTheme.spacing.sm};
`;

const Sender = styled.span<{ $isOwner: boolean }>`
  font-weight: ${aimTheme.fonts.weight.bold};
  color: ${(p) => (p.$isOwner ? aimTheme.colors.blue : aimTheme.colors.fireRed)};
  &::before { content: ${(p) => (p.$isOwner ? "'💬 '" : "'👤 '")}; }
`;

const MessageContent = styled.div`
  color: ${aimTheme.colors.black};
  margin-top: 2px;
  line-height: 1.4;
`;

const InputArea = styled.div`
  border-top: 1px solid ${aimTheme.colors.darkGray};
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.sm};
`;

const ChatInput = styled.textarea`
  width: calc(100% - 8px);
  height: 50px;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  resize: none;
  background: ${aimTheme.colors.white};
  margin: ${aimTheme.spacing.sm};
  &:focus { outline: none; }
`;

const BookmarkBar = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
  text-align: center;
  padding: 2px ${aimTheme.spacing.sm};
  border-top: 1px solid ${aimTheme.colors.darkGray};
  a { color: ${aimTheme.colors.blue}; }
`;

const MAX_LENGTH = 5000;
const CHAR_COUNT_WARN = 4500;
const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 480;
const POLL_INTERVAL_MS = 30000; // Fallback only; AppSync Events provides instant updates

function useCenteredPosition(width: number, height: number) {
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, (window.innerWidth - width) / 2),
    y: Math.max(0, (window.innerHeight - height) / 2 - 20),
  }));
  useEffect(() => {
    const onResize = () =>
      setPos({
        x: Math.max(0, (window.innerWidth - width) / 2),
        y: Math.max(0, (window.innerHeight - height) / 2 - 20),
      });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width, height]);
  return pos;
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const SendMessageWindow: React.FC<SendMessageWindowProps> = ({ linkId }) => {
  const [message, setMessage] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ display_name: string; description?: string; public_key?: string; opsec?: { passphrase_required: boolean } } | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentThreadId, setSentThreadId] = useState<string | null>(null);
  const [opsecInfo, setOpsecInfo] = useState<{ access_mode?: string; expires_at?: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { playMatchStrike, playMessageSend } = useAIMSounds();
  const prevMessageCountRef = useRef<number>(0);
  const center = useCenteredPosition(WINDOW_WIDTH, WINDOW_HEIGHT);

  // Auto-scroll on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Fetch link metadata
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiClient.get(
          endpoints.public.linkMetadata(linkId),
          { signal: controller.signal }
        );
        setLinkInfo(response.data.data);
      } catch (error) {
        if (!axios.isCancel(error)) console.error('Failed to fetch link metadata:', error);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [linkId]);

  // Poll thread messages (only after first send)
  const fetchMessages = useCallback(async (signal?: AbortSignal) => {
    if (!sentThreadId) return;
    try {
      const accessToken = getAccessToken(sentThreadId);
      const headers: Record<string, string> = {};
      if (accessToken) headers['X-Access-Token'] = accessToken;
      const res = await apiClient.get(endpoints.public.thread(sentThreadId), { signal, headers });
      const data = res.data?.data;
      const msgList: Message[] = Array.isArray(data?.messages) ? data.messages : [];

      // E2EE: decrypt messages client-side
      const senderData = getSenderKey(sentThreadId);
      let anonIndex = 0;
      for (const msg of msgList) {
        if (msg.sender_type === 'anonymous') {
          msg.content = senderData?.sentMessages[anonIndex] || '[Your message]';
          anonIndex++;
        } else if (msg.sender_type === 'owner' && senderData?.privateKeyJwk) {
          try {
            msg.content = await decrypt(msg.content, senderData.privateKeyJwk);
          } catch {
            msg.content = '[Unable to decrypt]';
          }
        } else if (msg.sender_type === 'owner') {
          msg.content = '[Key not available]';
        }
      }

      // Play sound on new messages from recipient
      if (msgList.length > prevMessageCountRef.current) {
        const hasNewOwnerMsg = msgList.slice(prevMessageCountRef.current).some(m => m.sender_type === 'owner');
        if (hasNewOwnerMsg) playMessageSend();
      }
      prevMessageCountRef.current = msgList.length;

      setChatMessages(msgList);
    } catch (err) {
      if (!axios.isCancel(err)) console.error('Failed to fetch thread:', err);
    }
  }, [sentThreadId, playMessageSend]);

  useEffect(() => {
    if (!sentThreadId) return;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      await fetchMessages(controller.signal);
      if (!stopped) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
    return () => { stopped = true; clearTimeout(timeoutId); controller.abort(); };
  }, [fetchMessages, sentThreadId]);

  // Real-time: subscribe to thread channel for instant updates
  useAppSyncEvents(
    sentThreadId ? `/messages/thread/${sentThreadId}` : null,
    useCallback(() => { fetchMessages(); }, [fetchMessages])
  );

  // First message send (E2EE only)
  const handleFirstSend = async () => {
    if (!message.trim() || sending || !linkInfo?.public_key) return;
    setSending(true);
    try {
      const { ciphertext, ephemeralPublicKeyBase64, ephemeralPrivateKeyJwk } =
        await encrypt(message.trim(), linkInfo.public_key);
      const body = { recipient_link_id: linkId, ciphertext, sender_public_key: ephemeralPublicKeyBase64, ...(passphrase && { passphrase }) };
      const res = await apiClient.post(endpoints.public.send(), body);
      const threadId = (res.data?.data as { thread_id?: string })?.thread_id;
      if (threadId) {
        saveSenderKey(threadId, { privateKeyJwk: ephemeralPrivateKeyJwk, sentMessages: [message.trim()] });
        setSentThreadId(threadId);
      }
      // OPSEC: store access token if present
      const resData = res?.data?.data as { thread_id?: string; access_token?: string; opsec?: { expires_at: string; access_mode: string } };
      if (resData?.access_token && resData?.thread_id) {
        const mode = (resData.opsec?.access_mode === 'single_use' ? 'single_use' : 'device_bound') as 'device_bound' | 'single_use';
        saveAccessToken(resData.thread_id, resData.access_token, mode);
        setOpsecInfo({ access_mode: resData.opsec?.access_mode, expires_at: resData.opsec?.expires_at });
      }
      playMatchStrike();
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      const errCode = axios.isAxiosError(error) && error.response?.data?.error?.code;
      if (errCode === 'VALIDATION_ERROR' && linkInfo?.opsec?.passphrase_required) {
        toast.error('Passphrase is required to send a message.');
      } else if (errCode === 'AUTHORIZATION_ERROR') {
        toast.error('Incorrect passphrase. Please try again.');
      } else {
        toast.error('Failed to send message. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  // Follow-up message send (E2EE only)
  const handleFollowUp = async () => {
    if (!message.trim() || sending || !sentThreadId || !linkInfo?.public_key) return;
    setSending(true);
    try {
      const { ciphertext } = await encrypt(message.trim(), linkInfo.public_key);
      const replyHeaders: Record<string, string> = {};
      const replyAccessToken = getAccessToken(sentThreadId);
      if (replyAccessToken) replyHeaders['X-Access-Token'] = replyAccessToken;
      await apiClient.post(endpoints.public.threadReply(sentThreadId), { ciphertext }, { headers: replyHeaders });
      addSentMessage(sentThreadId, message.trim());
      playMatchStrike();
      setMessage('');
      await fetchMessages();
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sentThreadId ? handleFollowUp() : handleFirstSend();
    }
  };

  const threadUrl = sentThreadId ? `${window.location.origin}/thread/${sentThreadId}` : '';

  if (loading) {
    return (
      <WindowFrame title="Loading..." width={WINDOW_WIDTH} height={WINDOW_HEIGHT} initialX={center.x} initialY={center.y}>
        <Container><div style={{ padding: aimTheme.spacing.md }}>Loading...</div></Container>
      </WindowFrame>
    );
  }

  if (!linkInfo) {
    return (
      <WindowFrame title="Error" width={WINDOW_WIDTH} height={WINDOW_HEIGHT} initialX={center.x} initialY={center.y}>
        <Container><div style={{ padding: aimTheme.spacing.md }}>Link not found or expired.</div></Container>
      </WindowFrame>
    );
  }

  // ── Live chat mode (after first send) ──
  if (sentThreadId) {
    return (
      <WindowFrame title={`Chat — ${linkInfo.display_name}`} width={WINDOW_WIDTH} height={WINDOW_HEIGHT} initialX={center.x} initialY={center.y}>
        <Container>
          <MessageArea>
            {chatMessages.length === 0 ? (
              <div style={{ color: aimTheme.colors.darkGray, fontStyle: 'italic' }}>
                Sending your message...
              </div>
            ) : (
              chatMessages.map((msg) => (
                <MessageBubble key={msg.message_id}>
                  <div>
                    <Timestamp>{formatTime(msg.created_at)}</Timestamp>
                    <Sender $isOwner={msg.sender_type === 'owner'}>
                      {msg.sender_type === 'owner' ? 'Recipient' : 'You'}:
                    </Sender>
                  </div>
                  <MessageContent>{msg.content}</MessageContent>
                </MessageBubble>
              ))
            )}
            <div ref={messageEndRef} />
          </MessageArea>
          <InputArea>
            <ChatInput
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Type a follow-up message..."
              maxLength={MAX_LENGTH}
            />
            {message.length > 0 && (
              <div style={{ fontSize: aimTheme.fonts.size.tiny, color: aimTheme.colors.darkGray, paddingLeft: aimTheme.spacing.sm }}>
                {message.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
              </div>
            )}
            <ButtonBar>
              <AIMButton onClick={handleFollowUp} disabled={!message.trim() || sending}>
                {sending ? 'Sending...' : 'Send'}
              </AIMButton>
            </ButtonBar>
          </InputArea>
          {opsecInfo && (
            <BookmarkBar style={{ background: '#FFFFCC', borderTop: '1px solid #E0E000' }}>
              OPSEC: {opsecInfo.access_mode === 'single_use' ? 'Session-only' : 'Device-bound'}
              {opsecInfo.expires_at && ` — expires ${new Date(opsecInfo.expires_at).toLocaleString()}`}
            </BookmarkBar>
          )}
          {opsecInfo?.access_mode !== 'single_use' && (
            <BookmarkBar>
              Bookmark to return later: <a href={threadUrl} target="_blank" rel="noopener noreferrer">{threadUrl}</a>
              {' · '}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(threadUrl);
                  toast.success('Thread link copied');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: aimTheme.colors.blue,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Copy link
              </button>
            </BookmarkBar>
          )}
        </Container>
      </WindowFrame>
    );
  }

  // ── Compose mode (first message) ──
  return (
    <WindowFrame title="Send Anonymous Message" width={WINDOW_WIDTH} height={WINDOW_HEIGHT} initialX={center.x} initialY={center.y}>
      <Container>
        <InfoSection>
          <LinkTitle>
            <span>Sending to:</span>
            <span>{linkInfo.display_name}</span>
          </LinkTitle>
          {linkInfo.description && <Description>{linkInfo.description}</Description>}
        </InfoSection>
        <ComposeSection>
          <Label>Your Anonymous Message:</Label>
          <ComposeTextArea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Type your anonymous message here..."
            maxLength={MAX_LENGTH}
          />
          <div style={{ fontSize: aimTheme.fonts.size.tiny, color: aimTheme.colors.darkGray, marginTop: 2 }}>
            {message.length > 0 && (
              <span style={message.length >= CHAR_COUNT_WARN ? { color: aimTheme.colors.fireRed } : undefined}>
                {message.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
              </span>
            )}
          </div>
          <PrivacyNote>
            {linkInfo?.public_key
              ? 'End-to-end encrypted. The server never sees your message — only the recipient can decrypt it.'
              : 'This link does not accept messages.'}
          </PrivacyNote>
          {linkInfo?.opsec?.passphrase_required && (
            <div style={{ marginTop: aimTheme.spacing.sm }}>
              <Label>Passphrase (from link owner):</Label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter the passphrase the link owner gave you"
                style={{
                  width: '100%',
                  border: aimTheme.borders.inset,
                  padding: aimTheme.spacing.sm,
                  fontFamily: aimTheme.fonts.primary,
                  fontSize: aimTheme.fonts.size.normal,
                  background: aimTheme.colors.white,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          <ButtonBar>
            <AIMButton onClick={handleFirstSend} disabled={!linkInfo?.public_key || !message.trim() || sending || (!!linkInfo?.opsec?.passphrase_required && !passphrase)}>
              {sending ? 'Sending...' : 'Send Message'}
            </AIMButton>
          </ButtonBar>
        </ComposeSection>
      </Container>
    </WindowFrame>
  );
};
