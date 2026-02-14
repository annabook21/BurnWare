/**
 * Broadcast Channel Window
 * Read URL, QR, add post form, link to public feed
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { WindowFrame } from './WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { encryptBroadcast } from '../../utils/broadcast-e2ee';
import { useAppSyncEvents } from '../../hooks/useAppSyncEvents';

interface BroadcastChannelWindowProps {
  channelId: string;
  channelName: string;
  readUrl: string;
  postToken?: string;
  encryptionKey?: string; // AES-256 key for E2EE
  onClose: () => void;
  onNewPost?: () => void; // called when a real-time post event arrives
  initialX?: number;
  initialY?: number;
  zIndex?: number;
}

const Content = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.sm};
`;

const Section = styled.div`
  margin-bottom: ${aimTheme.spacing.md};
`;

const Label = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  font-size: ${aimTheme.fonts.size.small};
  margin-bottom: 4px;
`;

const UrlBlock = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  word-break: break-all;
  padding: ${aimTheme.spacing.sm};
  background: ${aimTheme.colors.white};
  border: ${aimTheme.borders.inset};
`;

const QRWrap = styled.div`
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.md};
  border: ${aimTheme.borders.inset};
  display: inline-block;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  flex-wrap: wrap;
  margin-top: 4px;
`;

const Button = styled.button`
  padding: 4px 10px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.small};
  cursor: pointer;
`;

const Input = styled.input`
  width: 100%;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};
  margin-bottom: ${aimTheme.spacing.sm};
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 60px;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};
  resize: vertical;
`;

export const BroadcastChannelWindow: React.FC<BroadcastChannelWindowProps> = ({
  channelId,
  channelName,
  readUrl,
  postToken: initialPostToken,
  encryptionKey: initialEncryptionKey,
  onClose,
  onNewPost,
  initialX = 380,
  initialY = 80,
  zIndex = 200,
}) => {
  const [postToken, setPostToken] = useState(initialPostToken ?? '');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [recoveredKey, setRecoveredKey] = useState('');
  const encryptionKey = initialEncryptionKey || recoveredKey || undefined;

  const handleRecoverKey = (urlOrKey: string) => {
    const trimmed = urlOrKey.trim();
    const hashIdx = trimmed.indexOf('#');
    const key = hashIdx >= 0 ? trimmed.slice(hashIdx + 1) : trimmed;
    if (key) {
      setRecoveredKey(key);
      // Persist so it survives future refreshes
      try {
        const stored = JSON.parse(localStorage.getItem('bw:bc:encKeys') || '{}');
        stored[channelId] = key;
        localStorage.setItem('bw:bc:encKeys', JSON.stringify(stored));
      } catch { /* ignore */ }
      toast.success('Encryption key recovered');
    }
  };

  // Real-time: subscribe to broadcast channel events
  const broadcastChannel = `/broadcast/channel/${channelId.replace(/_/g, '-')}`;
  const handleBroadcastEvent = useCallback(() => {
    onNewPost?.();
  }, [onNewPost]);
  useAppSyncEvents(broadcastChannel, handleBroadcastEvent);

  const tokenToUse = initialPostToken ?? postToken;

  // Construct full URL with encryption key fragment
  const fullReadUrl = encryptionKey ? `${readUrl}#${encryptionKey}` : readUrl;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullReadUrl);
    toast.success('Read link copied (with encryption key)');
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !tokenToUse.trim()) {
      toast.error('Enter post content and post token');
      return;
    }
    if (!encryptionKey) {
      toast.error('Missing encryption key - cannot post securely');
      return;
    }
    setPosting(true);
    try {
      // Encrypt content client-side before sending
      const encryptedContent = await encryptBroadcast(content.trim(), encryptionKey);
      await apiClient.post(
        endpoints.public.broadcastAddPost(channelId),
        { post_token: tokenToUse, content: encryptedContent }
      );
      toast.success('Post added (encrypted)');
      setContent('');
    } catch (error) {
      console.error('Failed to add post:', error);
      toast.error('Failed to add post');
    } finally {
      setPosting(false);
    }
  };

  const openFeed = () => {
    window.open(fullReadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <WindowFrame
      title={`📡 ${channelName}`}
      width={380}
      height={420}
      initialX={initialX}
      initialY={initialY}
      zIndex={zIndex}
      onClose={onClose}
    >
      <Content>
        <Section>
          <Label>Read URL (share so others can view the feed)</Label>
          <UrlBlock>{fullReadUrl}</UrlBlock>
          <ButtonRow>
            <Button onClick={handleCopyLink}>Copy link</Button>
            <Button onClick={openFeed}>View public feed</Button>
          </ButtonRow>
        </Section>

        <Section>
          <Label>QR for read URL</Label>
          <QRWrap>
            <QRCodeSVG value={fullReadUrl} size={160} level="H" />
          </QRWrap>
        </Section>

        <Section>
          <Label>Add post</Label>
          {!encryptionKey && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#c00', fontSize: aimTheme.fonts.size.small, marginBottom: '4px' }}>
                Encryption key not available. Paste your read URL to recover it:
              </div>
              <Input
                type="text"
                placeholder="Paste read URL (https://...#key) or key"
                onBlur={(e) => handleRecoverKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRecoverKey((e.target as HTMLInputElement).value); }}
              />
            </div>
          )}
          {!initialPostToken && encryptionKey && (
            <Input
              type="text"
              placeholder="Post token (from when you created the channel)"
              value={postToken}
              onChange={(e) => setPostToken(e.target.value)}
            />
          )}
          {encryptionKey && (
            <form onSubmit={handleAddPost}>
              <TextArea
                placeholder="Post content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={10000}
              />
              <Button type="submit" disabled={posting || !content.trim() || !tokenToUse.trim()}>
                {posting ? 'Posting…' : 'Add post'}
              </Button>
            </form>
          )}
        </Section>
      </Content>
    </WindowFrame>
  );
};
