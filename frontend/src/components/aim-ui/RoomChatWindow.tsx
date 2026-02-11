/**
 * Room Chat Window Component
 * Multi-party E2E encrypted chat with AIM styling
 * Features: blur on tab switch, watermarking, real-time polling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from './WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getRoomKey, RoomKeyData } from '../../utils/key-store';
import { isVaultConfigured, isVaultUnlocked } from '../../utils/key-vault';
import { encryptGroupMessage, decryptGroupMessage } from '../../utils/room-e2ee';
import { embedWatermark } from '../../utils/watermark';
import { useAppSyncEvents } from '../../hooks/useAppSyncEvents';
import type { RoomMessage } from '../../types';

interface RoomChatWindowProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
}

interface DecryptedMessage extends RoomMessage {
  plaintext: string;
  isOwn: boolean;
}

const Content = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
`;

const MessageArea = styled.div<{ $blurred?: boolean }>`
  flex: 1;
  overflow-y: auto;
  padding: ${aimTheme.spacing.sm};
  background: ${aimTheme.colors.white};
  border: ${aimTheme.borders.inset};
  margin: ${aimTheme.spacing.sm};

  ${(p) =>
    p.$blurred &&
    `
    filter: blur(8px);
    user-select: none;
    pointer-events: none;
  `}
`;

const Message = styled.div<{ $isOwn?: boolean }>`
  padding: ${aimTheme.spacing.sm};
  margin-bottom: ${aimTheme.spacing.sm};
  border-radius: 4px;
  max-width: 85%;
  word-wrap: break-word;

  ${(p) =>
    p.$isOwn
      ? `
    background: ${aimTheme.colors.messageOwn || '#dcf8c6'};
    margin-left: auto;
  `
      : `
    background: ${aimTheme.colors.lightGray || '#f0f0f0'};
  `}
`;

const MessageHeader = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-bottom: 2px;
`;

const MessageText = styled.div`
  font-size: ${aimTheme.fonts.size.normal};
`;

const InputArea = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  padding: ${aimTheme.spacing.sm};
  border-top: 1px solid ${aimTheme.colors.darkGray};
`;

const TextInput = styled.input`
  flex: 1;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};

  &:focus {
    outline: none;
  }
`;

const SendButton = styled.button`
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  border: ${aimTheme.borders.outset};
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: bold;
  cursor: pointer;
  text-shadow: ${aimTheme.shadows.text};

  &:active {
    border-style: inset;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatusBar = styled.div`
  padding: 2px ${aimTheme.spacing.sm};
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  border-top: 1px solid ${aimTheme.colors.lightGray};
  display: flex;
  justify-content: space-between;
`;

const BlurOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: ${aimTheme.colors.white};
  font-size: ${aimTheme.fonts.size.large};
  z-index: 10;
`;

const ParticipantList = styled.div`
  padding: ${aimTheme.spacing.sm};
  background: ${aimTheme.colors.lightGray};
  font-size: ${aimTheme.fonts.size.small};
  border-bottom: 1px solid ${aimTheme.colors.darkGray};
`;

export const RoomChatWindow: React.FC<RoomChatWindowProps> = ({
  roomId,
  roomName,
  onClose,
  initialX = 350,
  initialY = 80,
  zIndex = 200,
}) => {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [roomKeys, setRoomKeys] = useState<RoomKeyData | null>(null);
  const [keysError, setKeysError] = useState<'vault_locked' | 'not_found' | null>(null);
  const [isBlurred, setIsBlurred] = useState(false);
  const [participants] = useState<Array<{ anonymous_id: string; display_name?: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCursorRef = useRef<{ time: string; messageId: string } | null>(null); // Cursor for pagination
  const sendingRef = useRef(false); // Synchronous guard against race conditions
  const fetchingRef = useRef(false); // Prevent concurrent fetches
  const refetchPendingRef = useRef(false); // Queue refetch if one is in progress

  // Load room keys
  useEffect(() => {
    const loadKeys = async () => {
      const keys = await getRoomKey(roomId);
      if (!keys) {
        const configured = await isVaultConfigured();
        if (configured && !isVaultUnlocked()) {
          setKeysError('vault_locked');
        } else {
          setKeysError('not_found');
          toast.error('Room keys not found. You may need to rejoin.');
          onClose();
        }
        return;
      }
      setKeysError(null);
      setRoomKeys(keys);
    };
    loadKeys();
  }, [roomId, onClose]);

  // Blur on tab switch (anti-leak)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsBlurred(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
      const rawMessages: RoomMessage[] = response.data.data?.messages || response.data.data || [];

      // Decrypt new messages
      const decrypted: DecryptedMessage[] = await Promise.all(
        rawMessages.map(async (msg) => {
          try {
            let plaintext = await decryptGroupMessage(
              msg.ciphertext,
              msg.nonce,
              roomKeys.groupKey
            );

            // Embed watermark for display (unique to this viewer)
            if (roomKeys.watermarkSeed) {
              plaintext = embedWatermark(plaintext, roomKeys.watermarkSeed);
            }

            return {
              ...msg,
              plaintext,
              isOwn: msg.anonymous_id === roomKeys.anonymousId,
            };
          } catch (err) {
            console.error('Failed to decrypt message:', err);
            return {
              ...msg,
              plaintext: '[Decryption failed]',
              isOwn: false,
            };
          }
        })
      );

      if (cursor && decrypted.length > 0) {
        // Append new messages (cursor-based pagination already ensures no duplicates)
        setMessages((prev) => [...prev, ...decrypted]);
      } else if (!cursor) {
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
    } catch (err) {
      console.error('Failed to fetch messages:', err);
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
  const handleMessageEvent = useCallback(() => {
    // New message event — fetch immediately
    void fetchMessages();
  }, [fetchMessages]);

  // AppSync channel for room messages
  const messageChannel = roomKeys ? `rooms/messages/${roomId}` : null;
  useAppSyncEvents(messageChannel, handleMessageEvent);

  // Initial fetch and fallback polling (longer interval since we have AppSync)
  useEffect(() => {
    if (!roomKeys) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchMessages();
      if (!stopped) {
        // 9 second fallback (AppSync is primary, this is safety net)
        timeoutId = setTimeout(poll, 9000);
      }
    };

    poll(); // Initial fetch
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [roomKeys, fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    // Use ref for synchronous check (state updates are async)
    if (!inputText.trim() || !roomKeys || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    try {
      const { ciphertext, nonce } = await encryptGroupMessage(inputText.trim(), roomKeys.groupKey);

      await apiClient.post(endpoints.public.roomMessages(roomId), {
        anonymous_id: roomKeys.anonymousId,
        ciphertext,
        nonce,
      });

      setInputText('');
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <WindowFrame
      title={`🔒 ${roomName}`}
      width={450}
      height={500}
      initialX={initialX}
      initialY={initialY}
      zIndex={zIndex}
      onClose={onClose}
    >
      <Content>
        {keysError === 'vault_locked' && (
          <div style={{ padding: aimTheme.spacing.lg, textAlign: 'center' }}>
            <p style={{ marginBottom: aimTheme.spacing.sm }}>
              Your vault is locked, so room keys cannot be read.
            </p>
            <p style={{ marginBottom: aimTheme.spacing.md, fontSize: aimTheme.fonts.size.small, color: aimTheme.colors.darkGray }}>
              Unlock your vault (e.g. from the taskbar) to open this room.
            </p>
            <SendButton onClick={onClose}>OK</SendButton>
          </div>
        )}
        {!roomKeys && !keysError && (
          <div style={{ padding: aimTheme.spacing.lg, textAlign: 'center', color: aimTheme.colors.darkGray }}>
            Loading...
          </div>
        )}
        {!keysError && participants.length > 0 && (
          <ParticipantList>
            👥 {participants.map((p) => p.display_name || 'Anon').join(', ')}
          </ParticipantList>
        )}

        {roomKeys && !keysError && (
          <>
        <MessageArea $blurred={isBlurred}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: aimTheme.colors.darkGray, padding: aimTheme.spacing.lg }}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <Message key={msg.message_id} $isOwn={msg.isOwn}>
                <MessageHeader>
                  {msg.display_name || 'Anonymous'} • {formatTime(msg.created_at)}
                </MessageHeader>
                <MessageText>{msg.plaintext}</MessageText>
              </Message>
            ))
          )}
          <div ref={messagesEndRef} />
        </MessageArea>

        {isBlurred && <BlurOverlay>🔒 Return to this tab to view</BlurOverlay>}

        <InputArea>
          <TextInput
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isBlurred || !roomKeys}
            autoFocus
          />
          <SendButton onClick={handleSend} disabled={!inputText.trim() || sending || isBlurred}>
            Send
          </SendButton>
        </InputArea>

        <StatusBar>
          <span>🔐 End-to-end encrypted</span>
          <span>{messages.length} messages</span>
        </StatusBar>
          </>
        )}
      </Content>
    </WindowFrame>
  );
};
