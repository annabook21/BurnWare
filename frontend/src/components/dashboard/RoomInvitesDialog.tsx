/**
 * Room Invites Dialog Component
 * Generate and manage room invite tokens
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { ConfirmDialog } from '../aim-ui/ConfirmDialog';
import { Button98, PrimaryButton } from '../aim-ui/Button98';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import type { Room, RoomInvite, GeneratedInvite } from '../../types';

interface RoomInvitesDialogProps {
  room: Room;
  onClose: () => void;
  autoGenerate?: boolean; // Auto-generate an invite on open (for newly created rooms)
}

const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const Section = styled.div`
  margin-bottom: ${aimTheme.spacing.lg};
`;

const SectionTitle = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.sm};
  border-bottom: 1px solid ${aimTheme.colors.darkGray};
  padding-bottom: 4px;
`;

const GenerateForm = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  align-items: flex-end;
`;

const Field = styled.div`
  flex: 1;
`;

const Label = styled.label`
  display: block;
  font-size: ${aimTheme.fonts.size.small};
  margin-bottom: 2px;
`;

const Input = styled.input`
  width: 100%;
  border: none;
  padding: 4px ${aimTheme.spacing.sm};
`;

const InviteList = styled.div`
  flex: 1;
  overflow-y: auto;
  box-shadow: var(--border-field);
  border: none;
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.sm};
`;

const InviteItem = styled.div<{ $used?: boolean }>`
  padding: ${aimTheme.spacing.sm};
  border-bottom: 1px solid ${aimTheme.colors.lightGray};
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: ${(p) => (p.$used ? 0.5 : 1)};

  &:last-child {
    border-bottom: none;
  }
`;

const InviteLabel = styled.span`
  font-weight: ${aimTheme.fonts.weight.bold};
`;

const InviteStatus = styled.span<{ $redeemed?: boolean }>`
  font-size: ${aimTheme.fonts.size.small};
  color: ${(p) => (p.$redeemed ? aimTheme.colors.green : aimTheme.colors.darkGray)};
`;

const NewInviteBox = styled.div`
  background: ${aimTheme.colors.flameYellow};
  border: none;
  padding: ${aimTheme.spacing.md};
  margin-bottom: ${aimTheme.spacing.md};
`;

const InviteUrl = styled.div`
  font-family: monospace;
  font-size: ${aimTheme.fonts.size.small};
  word-break: break-all;
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.sm};
  box-shadow: var(--border-field);
  border: none;
  margin: ${aimTheme.spacing.sm} 0;
`;

const Warning = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-top: ${aimTheme.spacing.sm};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${aimTheme.spacing.lg};
  color: ${aimTheme.colors.darkGray};
`;

const QRContainer = styled.div`
  display: flex;
  justify-content: center;
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.md};
  box-shadow: var(--border-field);
  border: none;
  margin: ${aimTheme.spacing.sm} 0;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  margin-top: ${aimTheme.spacing.sm};
`;

export const RoomInvitesDialog: React.FC<RoomInvitesDialogProps> = ({ room, onClose, autoGenerate }) => {
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [newInvites, setNewInvites] = useState<GeneratedInvite[]>([]);
  const [count] = useState(1);
  const [label, setLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revokeInviteId, setRevokeInviteId] = useState<string | null>(null);
  const autoGenerateTriggered = useRef(false);

  const fetchInvites = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.roomInvites(room.room_id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvites(response.data.data?.invites || []);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    }
  }, [room.room_id]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  // Auto-generate invite when dialog opens (for newly created rooms)
  useEffect(() => {
    if (autoGenerate && !autoGenerateTriggered.current && !generating) {
      autoGenerateTriggered.current = true;
      handleGenerate();
    }
  }, [autoGenerate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = await getAccessToken();
      const labels = label.trim() ? [label.trim()] : undefined;
      const response = await apiClient.post(
        endpoints.dashboard.roomInvites(room.room_id),
        { count, labels },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewInvites(response.data.data?.invites || []);
      setLabel('');
      await fetchInvites();
    } catch (error) {
      console.error('Failed to generate invites:', error);
      toast.error('Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyInvite = async (inv: GeneratedInvite) => {
    const url = `${window.location.origin}/r/join#${inv.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRevoke = (inviteId: string) => {
    setRevokeInviteId(inviteId);
  };

  const confirmRevoke = async () => {
    if (!revokeInviteId) return;
    const inviteId = revokeInviteId;
    setRevokeInviteId(null);

    try {
      const token = await getAccessToken();
      await apiClient.delete(endpoints.dashboard.roomInvite(room.room_id, inviteId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Invite revoked');
      await fetchInvites();
    } catch (error) {
      console.error('Failed to revoke invite:', error);
      toast.error('Failed to revoke invite');
    }
  };

  const isLocked = room.locked_at || new Date() > new Date(new Date(room.created_at).getTime() + room.join_window_minutes * 60 * 1000);

  return (
    <WindowFrame
      title={`📨 Invites - ${room.display_name}`}
      width={480}
      height={580}
      initialX={140}
      initialY={60}
      zIndex={1002}
      onClose={onClose}
    >
      <DialogContainer>
        {newInvites.length > 0 && (
          <NewInviteBox>
            <strong>New Invite{newInvites.length > 1 ? 's' : ''} Created!</strong>
            {newInvites.map((inv) => {
              const inviteUrl = `${window.location.origin}/r/join#${inv.token}`;
              return (
                <div key={inv.invite_id}>
                  <QRContainer>
                    <QRCodeSVG value={inviteUrl} size={180} level="H" />
                  </QRContainer>
                  <InviteUrl>{inviteUrl}</InviteUrl>
                  <ButtonRow>
                    <PrimaryButton onClick={() => handleCopyInvite(inv)}>📋 Copy Link</PrimaryButton>
                  </ButtonRow>
                </div>
              );
            })}
            <Warning>
              ⚠️ Save these links now! Tokens are only shown once.
            </Warning>
          </NewInviteBox>
        )}

        {!isLocked && (
          <Section>
            <SectionTitle>Generate Invite</SectionTitle>
            <GenerateForm>
              <Field>
                <Label>Label (optional)</Label>
                <Input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.slice(0, 50))}
                  placeholder="e.g., Alice"
                  maxLength={50}
                />
              </Field>
              <Button98 onClick={handleGenerate} disabled={generating}>
                {generating ? '...' : 'Generate'}
              </Button98>
            </GenerateForm>
          </Section>
        )}

        <Section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SectionTitle>Existing Invites</SectionTitle>
          <InviteList>
            {invites.length === 0 ? (
              <EmptyState>No invites yet</EmptyState>
            ) : (
              invites.map((inv) => (
                <InviteItem key={inv.invite_id} $used={inv.redeemed || inv.revoked}>
                  <div>
                    <InviteLabel>{inv.label || 'Unlabeled'}</InviteLabel>
                    <br />
                    <InviteStatus $redeemed={inv.redeemed}>
                      {inv.revoked ? '❌ Revoked' : inv.redeemed ? '✅ Used' : '⏳ Pending'}
                    </InviteStatus>
                  </div>
                  {!inv.redeemed && !inv.revoked && (
                    <Button98 onClick={() => handleRevoke(inv.invite_id)}>Revoke</Button98>
                  )}
                </InviteItem>
              ))
            )}
          </InviteList>
        </Section>
      </DialogContainer>

      {revokeInviteId && (
        <ConfirmDialog
          title="Revoke Invite"
          message="Revoke this invite? It will no longer be usable."
          icon="⚠️"
          confirmText="Revoke"
          onConfirm={confirmRevoke}
          onCancel={() => setRevokeInviteId(null)}
        />
      )}
    </WindowFrame>
  );
};
