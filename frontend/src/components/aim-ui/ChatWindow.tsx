/**
 * Chat Window Component
 * Thread view styled as AIM instant message window
 * File size: ~280 lines
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import type { Message } from '../../types';

interface ChatWindowProps {
  threadId: string;
  linkName: string;
  senderAnonymousId: string;
  messages: Message[];
  onSendMessage: (message: string) => void | Promise<void>;
  onBurn: () => void;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
  onFocus?: () => void;
}

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
`;

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

const MessageBubble = styled.div<{ isOwner: boolean }>`
  margin: ${aimTheme.spacing.sm} 0;
  padding: ${aimTheme.spacing.sm} 0;
  word-wrap: break-word;
`;

const Timestamp = styled.span`
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
  margin-right: ${aimTheme.spacing.sm};
`;

const Sender = styled.span<{ isOwner: boolean }>`
  font-weight: ${aimTheme.fonts.weight.bold};
  color: ${(props) => (props.isOwner ? aimTheme.colors.fireRed : aimTheme.colors.blue)};

  &::before {
    content: ${(props) => (props.isOwner ? "'🔥 '" : "'👤 '")};
  }
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

const TextInput = styled.textarea`
  width: calc(100% - 8px);
  height: 60px;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  resize: none;
  background: ${aimTheme.colors.white};
  margin: ${aimTheme.spacing.sm};

  &:focus {
    outline: none;
  }
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  padding: 0 ${aimTheme.spacing.sm} ${aimTheme.spacing.sm};
`;

const SendButton = styled.button`
  padding: 4px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;
  font-weight: bold;

  &:active {
    border-style: inset;
  }

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: not-allowed;
  }
`;

const BurnButton = styled.button`
  padding: 4px 12px;
  background: linear-gradient(
    to bottom,
    ${aimTheme.colors.brandOrange},
    ${aimTheme.colors.fireRed}
  );
  color: ${aimTheme.colors.white};
  border: 2px outset ${aimTheme.colors.fireRed};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: bold;
  cursor: pointer;
  text-shadow: ${aimTheme.shadows.text};

  &:hover {
    background: linear-gradient(to bottom, #FF8C55, #FF6520);
  }

  &:active {
    border-style: inset;
  }
`;

const CloseButton = styled(SendButton)``;

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  threadId: _threadId,
  linkName,
  senderAnonymousId,
  messages,
  onSendMessage,
  onBurn,
  onClose,
  initialX = 320,
  initialY = 50,
  zIndex = 101,
  onFocus,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { playFireIgnite } = useAIMSounds();

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSendMessage(inputValue);
      setInputValue('');
      playFireIgnite();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBurnClick = () => {
    if (window.confirm('🔥 This will permanently burn this thread and delete all messages. Continue?')) {
      onBurn();
    }
  };

  return (
    <WindowFrame
      title={`Thread - ${linkName}`}
      width={480}
      height={420}
      initialX={initialX}
      initialY={initialY}
      zIndex={zIndex}
      onClose={onClose}
      onFocus={onFocus}
    >
      <ChatContainer>
        <MessageArea>
          {messages.length === 0 ? (
            <div style={{ color: aimTheme.colors.darkGray, fontStyle: 'italic' }}>
              No messages yet. Waiting for anonymous sender...
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.message_id} isOwner={msg.sender_type === 'owner'}>
                <div>
                  <Timestamp>{formatTime(msg.created_at)}</Timestamp>
                  <Sender isOwner={msg.sender_type === 'owner'}>
                    {msg.sender_type === 'owner' ? 'You' : senderAnonymousId}:
                  </Sender>
                </div>
                <MessageContent>{msg.content}</MessageContent>
              </MessageBubble>
            ))
          )}
          <div ref={messageEndRef} />
        </MessageArea>

        <InputArea>
          <TextInput
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply here..."
            maxLength={5000}
          />
          <ButtonBar>
            <SendButton onClick={handleSend} disabled={!inputValue.trim() || isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </SendButton>
            <BurnButton onClick={handleBurnClick}>🔥 Burn</BurnButton>
            <CloseButton onClick={onClose}>Close</CloseButton>
          </ButtonBar>
        </InputArea>
      </ChatContainer>
    </WindowFrame>
  );
};
