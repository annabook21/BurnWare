/**
 * Room Approval Dialog Component
 * Approve or reject pending room participants
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { getRoomKey } from '../../utils/key-store';
import { wrapGroupKey } from '../../utils/room-e2ee';
import type { Room, RoomParticipant } from '../../types';

interface RoomApprovalDialogProps {
  room: Room;
  onClose: () => void;
}

const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const Header = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-bottom: ${aimTheme.spacing.md};
`;

const ParticipantList = styled.div`
  flex: 1;
  overflow-y: auto;
  border: ${aimTheme.borders.inset};
  background: ${aimTheme.colors.white};
`;

const ParticipantItem = styled.div`
  padding: ${aimTheme.spacing.md};
  border-bottom: 1px solid ${aimTheme.colors.lightGray};
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }
`;

const ParticipantInfo = styled.div`
  flex: 1;
`;

const ParticipantName = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
`;

const ParticipantMeta = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
`;

const Actions = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
`;

const Button = styled.button`
  padding: 4px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;

  &:active {
    border-style: inset;
  }

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: not-allowed;
  }
`;

const ApproveButton = styled(Button)`
  background: linear-gradient(to bottom, #90ee90, #32cd32);
  color: ${aimTheme.colors.white};
  font-weight: bold;
`;

const RejectButton = styled(Button)`
  background: linear-gradient(to bottom, #ffcccb, #ff6b6b);
  color: ${aimTheme.colors.white};
  font-weight: bold;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${aimTheme.spacing.xl};
  color: ${aimTheme.colors.darkGray};
`;

const RefreshButton = styled(Button)`
  margin-top: ${aimTheme.spacing.md};
`;

export const RoomApprovalDialog: React.FC<RoomApprovalDialogProps> = ({ room, onClose }) => {
  const [pending, setPending] = useState<RoomParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.roomPending(room.room_id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPending(response.data.data?.pending || []);
    } catch (error) {
      console.error('Failed to fetch pending:', error);
      toast.error('Failed to load pending participants');
    } finally {
      setLoading(false);
    }
  }, [room.room_id]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (participant: RoomParticipant) => {
    setProcessing(participant.participant_id);

    try {
      // Get room keys from local storage
      const roomKeys = await getRoomKey(room.room_id);
      if (!roomKeys) {
        toast.error('Room keys not found. You may need to rejoin as creator.');
        return;
      }

      // Wrap group key for this participant using their public key
      const wrappedGroupKey = await wrapGroupKey(
        roomKeys.groupKey,
        roomKeys.privateKeyJwk,
        participant.public_key
      );

      const token = await getAccessToken();
      await apiClient.post(
        endpoints.dashboard.roomApprove(room.room_id, participant.participant_id),
        { wrapped_group_key: wrappedGroupKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`${participant.display_name || 'Participant'} approved!`);
      await fetchPending();
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('Failed to approve participant');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (participant: RoomParticipant) => {
    if (!window.confirm(`Reject ${participant.display_name || 'this participant'}?`)) return;

    setProcessing(participant.participant_id);

    try {
      const token = await getAccessToken();
      await apiClient.post(
        endpoints.dashboard.roomReject(room.room_id, participant.participant_id),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Participant rejected');
      await fetchPending();
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error('Failed to reject participant');
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <WindowFrame
      title={`👥 Pending - ${room.display_name}`}
      width={400}
      height={400}
      initialX={220}
      initialY={120}
      zIndex={1003}
      onClose={onClose}
    >
      <DialogContainer>
        <Header>
          {room.auto_approve
            ? 'Auto-approve is ON - participants join automatically'
            : 'Review and approve participants who want to join this room'}
        </Header>

        <ParticipantList>
          {loading ? (
            <EmptyState>Loading...</EmptyState>
          ) : pending.length === 0 ? (
            <EmptyState>
              No pending requests
              <br />
              <RefreshButton onClick={fetchPending}>🔄 Refresh</RefreshButton>
            </EmptyState>
          ) : (
            pending.map((p) => (
              <ParticipantItem key={p.participant_id}>
                <ParticipantInfo>
                  <ParticipantName>{p.display_name || 'Anonymous'}</ParticipantName>
                  <ParticipantMeta>Requested at {formatTime(p.created_at)}</ParticipantMeta>
                </ParticipantInfo>
                <Actions>
                  <ApproveButton
                    onClick={() => handleApprove(p)}
                    disabled={!!processing}
                  >
                    {processing === p.participant_id ? '...' : '✓'}
                  </ApproveButton>
                  <RejectButton
                    onClick={() => handleReject(p)}
                    disabled={!!processing}
                  >
                    ✗
                  </RejectButton>
                </Actions>
              </ParticipantItem>
            ))
          )}
        </ParticipantList>

        <RefreshButton onClick={fetchPending} disabled={loading}>
          🔄 Refresh
        </RefreshButton>
      </DialogContainer>
    </WindowFrame>
  );
};
