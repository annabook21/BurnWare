/**
 * Room Create Dialog Component
 * Dialog for creating new secure chat rooms
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { generateGroupKey, generateECDHKeyPair, wrapGroupKey } from '../../utils/room-e2ee';
import { saveRoomKey } from '../../utils/key-store';
import { isVaultConfigured, isVaultUnlocked } from '../../utils/key-vault';
import type { Room } from '../../types';

interface RoomCreateDialogProps {
  onSave: (room?: Room) => void;
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

const HelpText = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-top: 2px;
`;

const Input = styled.input`
  width: 100%;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};

  &:focus {
    outline: none;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 60px;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  resize: vertical;
  background: ${aimTheme.colors.white};

  &:focus {
    outline: none;
  }
`;

const Select = styled.select`
  width: 100%;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  justify-content: flex-end;
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

  &:active {
    border-style: inset;
  }

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: not-allowed;
  }
`;

const CreateButton = styled(Button)`
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-weight: bold;
  text-shadow: ${aimTheme.shadows.text};
`;

const InfoBox = styled.div`
  background: ${aimTheme.colors.lightYellow || '#fffde7'};
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-size: ${aimTheme.fonts.size.small};
  margin-bottom: ${aimTheme.spacing.lg};
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
  cursor: pointer;
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

export const RoomCreateDialog: React.FC<RoomCreateDialogProps> = ({ onSave, onClose }) => {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [joinWindow, setJoinWindow] = useState(15);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [autoApprove, setAutoApprove] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast.error('Please enter a room name');
      return;
    }

    const vaultConfigured = await isVaultConfigured();
    if (!vaultConfigured) {
      toast.error('Set up your backup vault first so your room key can be stored securely.');
      return;
    }
    if (!isVaultUnlocked()) {
      toast.error('Unlock your vault to create a room (your key will be stored encrypted).');
      return;
    }

    setCreating(true);

    try {
      // Generate room encryption keys
      const groupKey = await generateGroupKey();
      const { publicKeyBase64: roomPublicKey, privateKeyJwk: roomPrivateKey } = await generateECDHKeyPair();
      const { publicKeyBase64: creatorPublicKey } = await generateECDHKeyPair();

      // Wrap group key for creator
      const creatorWrappedKey = await wrapGroupKey(groupKey, roomPrivateKey, creatorPublicKey);

      const token = await getAccessToken();
      const response = await apiClient.post(
        endpoints.dashboard.rooms(),
        {
          display_name: displayName.trim(),
          description: description.trim() || undefined,
          join_window_minutes: joinWindow,
          max_participants: maxParticipants,
          auto_approve: autoApprove,
          group_public_key: roomPublicKey,
          creator_public_key: creatorPublicKey,
          creator_wrapped_group_key: creatorWrappedKey,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const room = response.data.data;

      // Save keys locally
      // Store roomPrivateKey (not creatorPrivateKey) so we can wrap keys for new participants
      // The groupKey is already decrypted, so creator doesn't need creatorPrivateKey
      await saveRoomKey(room.room_id, {
        roomId: room.room_id,
        groupKey,
        privateKeyJwk: roomPrivateKey,
        publicKeyBase64: roomPublicKey,
        anonymousId: room.creator_anonymous_id,
        watermarkSeed: '', // Creator doesn't need watermark
        isCreator: true,
      });

      onSave(room as Room);
    } catch (error) {
      const err = error as { message?: string };
      if (err.message === 'VAULT_LOCKED') {
        toast.error('Unlock your vault to store the room key securely.');
        return;
      }
      console.error('Failed to create room:', error);
      toast.error('Failed to create room. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <WindowFrame
      title="🔒 Create Secure Room"
      width={400}
      height={480}
      initialX={180}
      initialY={120}
      zIndex={1001}
      onClose={onClose}
    >
      <DialogContainer>
        <InfoBox>
          Rooms auto-delete after 24 hours. All messages are end-to-end encrypted.
        </InfoBox>

        <Field>
          <Label>Room Name *</Label>
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
            placeholder="e.g., Team Huddle"
            maxLength={100}
            autoFocus
          />
        </Field>

        <Field>
          <Label>Description (Optional)</Label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="What's this room for?"
            maxLength={500}
          />
        </Field>

        <Field>
          <Label>Join Window</Label>
          <Select value={joinWindow} onChange={(e) => setJoinWindow(Number(e.target.value))}>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </Select>
          <HelpText>Room locks to new participants after this time</HelpText>
        </Field>

        <Field>
          <Label>Max Participants</Label>
          <Select value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))}>
            <option value="2">2</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </Select>
        </Field>

        <Field>
          <CheckboxRow>
            <Checkbox
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
            />
            <span>Auto-approve participants</span>
          </CheckboxRow>
          <HelpText>
            {autoApprove
              ? 'Participants join instantly when you have the dashboard open'
              : 'You must manually approve each participant'}
          </HelpText>
        </Field>

        <ButtonBar>
          <CreateButton onClick={handleCreate} disabled={!displayName.trim() || creating}>
            {creating ? 'Creating...' : '🔒 Create Room'}
          </CreateButton>
          <Button onClick={onClose} disabled={creating}>
            Cancel
          </Button>
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
