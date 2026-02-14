/**
 * Room Page
 * Full-page room chat view for approved participants
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { toast } from 'sonner';
import { aimTheme } from '../theme/aim-theme';
import { useRoomPolling } from '../hooks/useRoomPolling';
import { getRoomKey } from '../utils/key-store';
import { embedWatermark } from '../utils/watermark';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${aimTheme.colors.desktopTeal};
`;

const Header = styled.div`
  background: linear-gradient(to right, ${aimTheme.colors.brandBlue}, ${aimTheme.colors.brandBlue}cc);
  color: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.md};
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: ${aimTheme.shadows.window};
`;

const RoomTitle = styled.h1`
  margin: 0;
  font-size: ${aimTheme.fonts.size.large};
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
`;

const LeaveButton = styled.button`
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  cursor: pointer;

  &:active {
    border-style: inset;
  }
`;

const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: ${aimTheme.spacing.md};
`;

const MessageList = styled.div<{ $blurred?: boolean }>`
  flex: 1;
  overflow-y: auto;
  background: ${aimTheme.colors.white};
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.md};
  margin-bottom: ${aimTheme.spacing.md};

  ${(p) =>
    p.$blurred &&
    `
    filter: blur(8px);
    user-select: none;
  `}
`;

const Message = styled.div<{ $isOwn?: boolean }>`
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  margin-bottom: ${aimTheme.spacing.sm};
  border-radius: 8px;
  max-width: 70%;
  word-wrap: break-word;

  ${(p) =>
    p.$isOwn
      ? `
    background: #dcf8c6;
    margin-left: auto;
    text-align: right;
  `
      : `
    background: ${aimTheme.colors.lightGray};
  `}
`;

const MessageSender = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-bottom: 2px;
`;

const MessageTime = styled.span`
  font-size: 10px;
  color: ${aimTheme.colors.darkGray};
  margin-left: ${aimTheme.spacing.sm};
`;

const InputContainer = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
`;

const TextInput = styled.input`
  flex: 1;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.md};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};

  &:focus {
    outline: none;
  }
`;

const SendButton = styled.button`
  padding: ${aimTheme.spacing.md} ${aimTheme.spacing.xl};
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
  text-align: center;
  padding: ${aimTheme.spacing.sm};
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.white};
`;

const BlurNotice = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: ${aimTheme.spacing.xl};
  border-radius: 8px;
  font-size: ${aimTheme.fonts.size.large};
  z-index: 1000;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${aimTheme.spacing.xl};
  color: ${aimTheme.colors.darkGray};
`;

export const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [watermarkSeed, setWatermarkSeed] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false); // Synchronous guard against race conditions

  const { messages, loading, error, sendMessage } = useRoomPolling(roomId || '');

  // Load watermark seed
  useEffect(() => {
    const loadWatermark = async () => {
      if (!roomId) return;
      const keys = await getRoomKey(roomId);
      if (keys?.watermarkSeed) {
        setWatermarkSeed(keys.watermarkSeed);
      }
    };
    loadWatermark();
  }, [roomId]);

  // Blur on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsBlurred(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    // Use ref for synchronous check (state updates are async)
    if (!inputText.trim() || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    try {
      await sendMessage(inputText.trim());
      setInputText('');
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Failed to send message');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [inputText, sendMessage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeave = () => {
    if (window.confirm('Leave this room? You can rejoin if you have the invite link.')) {
      navigate('/');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayText = (plaintext: string) => {
    if (watermarkSeed) {
      return embedWatermark(plaintext, watermarkSeed);
    }
    return plaintext;
  };

  if (!roomId) {
    return <div>Invalid room</div>;
  }

  if (error) {
    return (
      <PageContainer>
        <ChatContainer>
          <EmptyState>
            {error}
            <br />
            <LeaveButton onClick={() => navigate('/')} style={{ marginTop: '16px' }}>
              Return Home
            </LeaveButton>
          </EmptyState>
        </ChatContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header>
        <RoomTitle>🔒 Secure Room</RoomTitle>
        <LeaveButton onClick={handleLeave}>Leave Room</LeaveButton>
      </Header>

      <ChatContainer>
        <MessageList $blurred={isBlurred}>
          {loading ? (
            <EmptyState>Loading messages...</EmptyState>
          ) : messages.length === 0 ? (
            <EmptyState>No messages yet. Start the conversation!</EmptyState>
          ) : (
            messages.map((msg) => (
              <Message key={msg.message_id} $isOwn={msg.isOwn}>
                <MessageSender>
                  {msg.display_name || 'Anonymous'}
                  <MessageTime>{formatTime(msg.created_at)}</MessageTime>
                </MessageSender>
                {getDisplayText(msg.plaintext)}
              </Message>
            ))
          )}
          <div ref={messagesEndRef} />
        </MessageList>

        {isBlurred && <BlurNotice>🔒 Return to this tab to view messages</BlurNotice>}

        <InputContainer>
          <TextInput
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isBlurred || loading}
            autoFocus
          />
          <SendButton onClick={handleSend} disabled={!inputText.trim() || sending || isBlurred}>
            {sending ? '...' : 'Send'}
          </SendButton>
        </InputContainer>
      </ChatContainer>

      <StatusBar>🔐 End-to-end encrypted • Room auto-deletes after 24 hours</StatusBar>
    </PageContainer>
  );
};
