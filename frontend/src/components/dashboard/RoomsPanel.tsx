/**
 * Rooms Panel Component
 * Room management list with AIM styling
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { RoomCreateDialog } from './RoomCreateDialog';
import { RoomInvitesDialog } from './RoomInvitesDialog';
import { RoomApprovalDialog } from './RoomApprovalDialog';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import type { Room } from '../../types';

interface RoomsPanelProps {
  onOpenRoom: (roomId: string, roomName: string) => void;
  zIndex?: number;
}

const Content = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
`;

const Header = styled.div`
  padding: ${aimTheme.spacing.sm};
  border-bottom: 1px solid ${aimTheme.colors.darkGray};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.span`
  font-weight: ${aimTheme.fonts.weight.bold};
  font-size: ${aimTheme.fonts.size.small};
`;

const CreateButton = styled.button`
  padding: 2px 8px;
  border: ${aimTheme.borders.outset};
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.small};
  font-weight: bold;
  cursor: pointer;
  text-shadow: ${aimTheme.shadows.text};

  &:active {
    border-style: inset;
  }
`;

const RoomList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${aimTheme.spacing.sm};
`;

const RoomItem = styled.div<{ $hasActivity?: boolean }>`
  display: flex;
  align-items: center;
  padding: ${aimTheme.spacing.sm};
  border: ${aimTheme.borders.inset};
  background: ${aimTheme.colors.white};
  margin-bottom: ${aimTheme.spacing.sm};
  cursor: pointer;

  ${(p) => p.$hasActivity && `
    background: ${aimTheme.colors.flameYellow};
  `}

  &:hover {
    background: ${aimTheme.colors.menuHover};
  }
`;

const RoomIcon = styled.span`
  font-size: 16px;
  margin-right: ${aimTheme.spacing.sm};
`;

const RoomInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const RoomName = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  font-size: ${aimTheme.fonts.size.normal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RoomMeta = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
`;

const RoomActions = styled.div`
  display: flex;
  gap: 4px;
`;

const ActionButton = styled.button`
  padding: 2px 6px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-size: ${aimTheme.fonts.size.small};
  cursor: pointer;

  &:active {
    border-style: inset;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${aimTheme.spacing.lg};
  color: ${aimTheme.colors.darkGray};
  font-size: ${aimTheme.fonts.size.small};
`;

export const RoomsPanel: React.FC<RoomsPanelProps> = ({ onOpenRoom, zIndex }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showInvitesDialog, setShowInvitesDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [autoGenerateInvite, setAutoGenerateInvite] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.rooms(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleRoomCreated = async (createdRoom?: Room) => {
    setShowCreateDialog(false);
    await fetchRooms();
    toast.success('Room created!');

    // Auto-open invites dialog with auto-generate for newly created room
    if (createdRoom) {
      setSelectedRoom(createdRoom);
      setAutoGenerateInvite(true);
      setShowInvitesDialog(true);
    }
  };

  const handleBurnRoom = async (room: Room) => {
    if (!window.confirm(`Permanently delete room "${room.display_name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const token = await getAccessToken();
      await apiClient.post(endpoints.dashboard.roomBurn(room.room_id), {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Room burned');
      await fetchRooms();
    } catch (error) {
      console.error('Failed to burn room:', error);
      toast.error('Failed to burn room');
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isLocked = (room: Room) => {
    if (room.locked_at) return true;
    const created = new Date(room.created_at);
    const lockTime = new Date(created.getTime() + room.join_window_minutes * 60 * 1000);
    return new Date() > lockTime;
  };

  return (
    <>
      <WindowFrame
        title="🔒 Secure Rooms"
        width={320}
        height={400}
        initialX={50}
        initialY={80}
        zIndex={zIndex || 100}
      >
        <Content>
          <Header>
            <Title>My Chat Rooms</Title>
            <CreateButton onClick={() => setShowCreateDialog(true)}>+ New Room</CreateButton>
          </Header>

          <RoomList>
            {loading ? (
              <EmptyState>Loading...</EmptyState>
            ) : rooms.length === 0 ? (
              <EmptyState>No rooms yet. Create one to start!</EmptyState>
            ) : (
              rooms.map((room) => (
                <RoomItem
                  key={room.room_id}
                  $hasActivity={room.participant_count > 1}
                  onClick={() => onOpenRoom(room.room_id, room.display_name)}
                >
                  <RoomIcon>{isLocked(room) ? '🔐' : '🚪'}</RoomIcon>
                  <RoomInfo>
                    <RoomName>{room.display_name}</RoomName>
                    <RoomMeta>
                      {room.participant_count}/{room.max_participants} participants • {formatTimeRemaining(room.expires_at)}
                    </RoomMeta>
                  </RoomInfo>
                  <RoomActions onClick={(e) => e.stopPropagation()}>
                    <ActionButton
                      onClick={() => {
                        setSelectedRoom(room);
                        setShowInvitesDialog(true);
                      }}
                      title="Invite"
                    >
                      📨
                    </ActionButton>
                    <ActionButton
                      onClick={() => {
                        setSelectedRoom(room);
                        setShowApprovalDialog(true);
                      }}
                      title="Pending"
                    >
                      👥
                    </ActionButton>
                    <ActionButton onClick={() => handleBurnRoom(room)} title="Burn">
                      🔥
                    </ActionButton>
                  </RoomActions>
                </RoomItem>
              ))
            )}
          </RoomList>
        </Content>
      </WindowFrame>

      {showCreateDialog && (
        <RoomCreateDialog
          onSave={handleRoomCreated}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {showInvitesDialog && selectedRoom && (
        <RoomInvitesDialog
          room={selectedRoom}
          autoGenerate={autoGenerateInvite}
          onClose={() => {
            setShowInvitesDialog(false);
            setSelectedRoom(null);
            setAutoGenerateInvite(false);
          }}
        />
      )}

      {showApprovalDialog && selectedRoom && (
        <RoomApprovalDialog
          room={selectedRoom}
          onClose={() => {
            setShowApprovalDialog(false);
            setSelectedRoom(null);
            fetchRooms();
          }}
        />
      )}
    </>
  );
};
