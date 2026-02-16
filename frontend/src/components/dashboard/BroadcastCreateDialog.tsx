/**
 * Broadcast Create Dialog
 * Create channel → show read URL, post token, QR for read URL
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { generateBroadcastKey } from '../../utils/broadcast-e2ee';
import type { CreateBroadcastChannelResult } from '../../types';

interface BroadcastCreateDialogProps {
  onSave: (result: CreateBroadcastChannelResult) => void;
  onClose: () => void;
}

const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const Field = styled.div`
  margin-bottom: ${aimTheme.spacing.lg};
`;

const Label = styled.label`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.sm};
  display: block;
`;

const Input = styled.input`
  width: 100%;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};
`;

const QRContainer = styled.div`
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.lg};
  border: ${aimTheme.borders.inset};
  margin: ${aimTheme.spacing.md} 0;
  align-self: center;
`;

const UrlBlock = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  word-break: break-all;
  padding: ${aimTheme.spacing.sm};
  background: ${aimTheme.colors.white};
  border: ${aimTheme.borders.inset};
  margin: ${aimTheme.spacing.sm} 0;
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  flex-wrap: wrap;
  margin-top: auto;
`;

const Button = styled.button`
  padding: 4px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;
  min-width: 75px;
`;

export const BroadcastCreateDialog: React.FC<BroadcastCreateDialogProps> = ({
  onSave,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateBroadcastChannelResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    try {
      // Generate E2EE key client-side before API call
      const encryptionKey = await generateBroadcastKey();
      const token = await getAccessToken();
      const response = await apiClient.post(
        endpoints.public.broadcastCreate(),
        { display_name: displayName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw = response.data;
      if (typeof raw === 'string' && raw.trimStart().startsWith('<!')) {
        console.error('API returned HTML instead of JSON — request likely hit the SPA origin.', raw.slice(0, 200));
        throw new Error('API_UNREACHABLE');
      }
      const data = (raw?.data ?? raw) as CreateBroadcastChannelResult | undefined;
      if (!data?.read_url) {
        console.error('Unexpected API response:', raw);
        throw new Error('Invalid response from server');
      }
      // Attach encryption key and modify read_url to include fragment
      const resultWithKey: CreateBroadcastChannelResult = {
        ...data,
        encryption_key: encryptionKey,
        read_url: `${data.read_url}#${encryptionKey}`,
      };
      setResult(resultWithKey);
      // Auto-copy read link so owner can share in one less click
      const readUrlWithKey = `${data.read_url}#${encryptionKey}`;
      navigator.clipboard.writeText(readUrlWithKey).catch(() => {});
      toast.success('Read link copied to clipboard — share it so people can view the feed');
    } catch (error) {
      console.error('Failed to create broadcast channel:', error);
      const isApiUnreachable =
        (error as { code?: string; message?: string })?.code === 'API_UNREACHABLE' ||
        (error instanceof Error && (error.message === 'API_UNREACHABLE' || error.message.includes('API returned HTML')));
      const message = isApiUnreachable
        ? 'API unreachable. On dev, ensure CloudFront routes /api/* to your backend (redeploy Frontend stack with ALB).'
        : 'Failed to create channel. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.read_url);
    toast.success('Read link copied!');
  };

  const handleCopyToken = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.post_token);
    toast.success('Post token copied! Save it — it won’t be shown again.');
  };

  const handleDone = () => {
    if (result) onSave(result);
    onClose();
  };

  if (result) {
    return (
      <WindowFrame
        title="Broadcast channel created"
        width={400}
        height={520}
        initialX={200}
        initialY={100}
        zIndex={1002}
        onClose={onClose}
      >
        <DialogContainer>
          <Field>
            <Label>Channel: {result.display_name}</Label>
            <Label style={{ fontWeight: 'normal', fontSize: aimTheme.fonts.size.small }}>
              Read URL (share this so people can view the feed):
            </Label>
            <UrlBlock>{result.read_url}</UrlBlock>
          </Field>
          <Field>
            <Label style={{ fontSize: aimTheme.fonts.size.small }}>
              Post token (keep secret — use to add posts or burn the channel):
            </Label>
            <UrlBlock style={{ wordBreak: 'break-all' }}>{result.post_token}</UrlBlock>
          </Field>
          <QRContainer>
            <QRCodeSVG value={result.read_url} size={200} level="H" />
          </QRContainer>
          <ButtonBar>
            <Button onClick={handleCopyLink}>Copy read link</Button>
            <Button onClick={handleCopyToken}>Copy post token</Button>
            <Button onClick={handleDone}>Done</Button>
          </ButtonBar>
        </DialogContainer>
      </WindowFrame>
    );
  }

  return (
    <WindowFrame
      title="New broadcast channel"
      width={360}
      height={200}
      initialX={220}
      initialY={120}
      zIndex={1002}
      onClose={onClose}
    >
      <DialogContainer>
        <form onSubmit={handleSubmit}>
          <Field>
            <Label>Channel name</Label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Community Alerts"
              maxLength={100}
              autoFocus
            />
          </Field>
          <ButtonBar>
            <Button type="submit" disabled={loading || !displayName.trim()}>
              {loading ? 'Creating…' : 'Create channel'}
            </Button>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
          </ButtonBar>
        </form>
      </DialogContainer>
    </WindowFrame>
  );
};
