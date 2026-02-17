/**
 * Chat Window Component
 * Thread view styled as AIM instant message window
 * File size: ~280 lines
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { ConfirmDialog } from './ConfirmDialog';
import { CharCounter } from './CharCounter';
import { Button98, BurnButton as BurnBtn } from './Button98';
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
  box-shadow: var(--border-field);
  border: none;
  padding: ${aimTheme.spacing.md};
  overflow-y: auto;
  margin: ${aimTheme.spacing.sm};
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
  border: none;
  padding: ${aimTheme.spacing.sm};
  resize: none;
  margin: ${aimTheme.spacing.sm};

  &:focus {
    outline: 1px dotted black;
    outline-offset: -2px;
  }
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  padding: 0 ${aimTheme.spacing.sm} ${aimTheme.spacing.sm};
`;


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
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
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
    setShowBurnConfirm(true);
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
            autoFocus
          />
          <div style={{ padding: `0 ${aimTheme.spacing.sm}` }}>
            <CharCounter current={inputValue.length} max={5000} />
          </div>
          <ButtonBar>
            <Button98 style={{ fontWeight: 'bold' }} onClick={handleSend} disabled={!inputValue.trim() || isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </Button98>
            <BurnBtn onClick={handleBurnClick}>🔥 Burn</BurnBtn>
            <Button98 onClick={onClose}>Close</Button98>
          </ButtonBar>
        </InputArea>
      </ChatContainer>

      {showBurnConfirm && (
        <ConfirmDialog
          title="Burn Thread"
          message="This will permanently burn this thread and delete all messages. Continue?"
          icon="⚠️"
          confirmText="Burn"
          onConfirm={() => { setShowBurnConfirm(false); onBurn(); }}
          onCancel={() => setShowBurnConfirm(false)}
        />
      )}
    </WindowFrame>
  );
};
