/**
 * Send Message Window Component
 * Anonymous message sending interface (AIM style)
 * File size: ~220 lines
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import axios from 'axios';
import { awsConfig } from '../../config/aws-config';

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
  padding: ${aimTheme.spacing.md};
  background: linear-gradient(to bottom, #FFFFFF, #F0F0F0);
  border-bottom: 1px solid ${aimTheme.colors.darkGray};
`;

const LinkTitle = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  font-size: ${aimTheme.fonts.size.medium};
  margin-bottom: ${aimTheme.spacing.sm};
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
`;

const Description = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: #666;
  font-style: italic;
`;

const MessageSection = styled.div`
  flex: 1;
  padding: ${aimTheme.spacing.md};
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.sm};
`;

const TextArea = styled.textarea`
  flex: 1;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.md};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  resize: none;
  background: ${aimTheme.colors.white};

  &:focus {
    outline: none;
  }
`;

const CharCount = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: ${aimTheme.colors.darkGray};
  text-align: right;
  margin-top: ${aimTheme.spacing.sm};
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

const SendButton = styled.button`
  padding: 6px 20px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: bold;
  cursor: pointer;
  min-width: 100px;

  &:active {
    border-style: inset;
  }

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: not-allowed;
  }
`;

const MAX_LENGTH = 5000;

export const SendMessageWindow: React.FC<SendMessageWindowProps> = ({ linkId }) => {
  const [message, setMessage] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ display_name: string; description?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { playMatchStrike } = useAIMSounds();

  useEffect(() => {
    fetchLinkMetadata();
  }, [linkId]);

  const fetchLinkMetadata = async () => {
    try {
      const response = await axios.get(`${awsConfig.api.baseUrl}/api/v1/link/${linkId}/metadata`);
      setLinkInfo(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch link metadata:', error);
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await axios.post(`${awsConfig.api.baseUrl}/api/v1/send`, {
        recipient_link_id: linkId,
        message: message.trim(),
      });

      playMatchStrike();
      alert('✅ Message sent successfully!\n\nYour message is anonymous and the recipient can view it in their dashboard.');
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('❌ Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <WindowFrame title="Loading..." width={500} height={400}>
        <Container>
          <div style={{ padding: aimTheme.spacing.md }}>Loading...</div>
        </Container>
      </WindowFrame>
    );
  }

  if (!linkInfo) {
    return (
      <WindowFrame title="Error" width={400} height={200}>
        <Container>
          <div style={{ padding: aimTheme.spacing.md }}>Link not found or expired.</div>
        </Container>
      </WindowFrame>
    );
  }

  return (
    <WindowFrame title="📨 Send Anonymous Message" width={520} height={480}>
      <Container>
        <InfoSection>
          <LinkTitle>
            <span>📨 Sending to:</span>
            <span>{linkInfo.display_name}</span>
          </LinkTitle>
          {linkInfo.description && <Description>{linkInfo.description}</Description>}
        </InfoSection>

        <MessageSection>
          <Label>Your Anonymous Message:</Label>
          <TextArea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Type your anonymous message here..."
            maxLength={MAX_LENGTH}
          />
          <CharCount>{MAX_LENGTH - message.length} characters remaining</CharCount>

          <PrivacyNote>
            🔒 Your message is completely anonymous. The recipient can burn the thread at any time.
          </PrivacyNote>

          <ButtonBar>
            <SendButton onClick={handleSend} disabled={!message.trim() || sending}>
              {sending ? 'Sending...' : '📤 Send Message'}
            </SendButton>
          </ButtonBar>
        </MessageSection>
      </Container>
    </WindowFrame>
  );
};
