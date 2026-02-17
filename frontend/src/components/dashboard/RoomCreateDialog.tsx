/**
 * Room Create Dialog Component
 * Dialog for creating new secure chat rooms
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { CharCounter } from '../aim-ui/CharCounter';
import { Button98, PrimaryButton } from '../aim-ui/Button98';
import { Field, FieldLabel, HelpText, FullInput, FullTextArea, FullSelect, ButtonBar } from '../aim-ui/FormField';
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const InfoBox = styled.div`
  background: ${aimTheme.colors.lightYellow || '#fffde7'};
  box-shadow: var(--border-field);
  padding: ${aimTheme.spacing.sm};
  font-size: ${aimTheme.fonts.size.small};
  margin-bottom: ${aimTheme.spacing.lg};
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
      width={440}
      height={540}
      initialX={140}
      initialY={60}
      zIndex={1001}
      onClose={onClose}
    >
      <DialogContainer>
        <InfoBox>
          Rooms auto-delete after 24 hours. All messages are end-to-end encrypted.
        </InfoBox>

        <Field>
          <FieldLabel>Room Name *</FieldLabel>
          <FullInput
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
            placeholder="e.g., Team Huddle"
            maxLength={100}
            autoFocus
          />
          <CharCounter current={displayName.length} max={100} />
        </Field>

        <Field>
          <FieldLabel>Description (Optional)</FieldLabel>
          <FullTextArea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="What's this room for?"
            maxLength={500}
          />
          <CharCounter current={description.length} max={500} />
        </Field>

        <Field>
          <FieldLabel>Join Window</FieldLabel>
          <FullSelect value={joinWindow} onChange={(e) => setJoinWindow(Number(e.target.value))}>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </FullSelect>
          <HelpText>Room locks to new participants after this time</HelpText>
        </Field>

        <Field>
          <FieldLabel>Max Participants</FieldLabel>
          <FullSelect value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))}>
            <option value="2">2</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </FullSelect>
        </Field>

        <Field>
          <div className="field-row">
            <input
              id="auto-approve"
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
            />
            <label htmlFor="auto-approve">Auto-approve participants</label>
          </div>
          <HelpText>
            {autoApprove
              ? 'Participants join instantly when you have the dashboard open'
              : 'You must manually approve each participant'}
          </HelpText>
        </Field>

        <ButtonBar>
          <PrimaryButton onClick={handleCreate} disabled={!displayName.trim() || creating}>
            {creating ? 'Creating...' : '🔒 Create Room'}
          </PrimaryButton>
          <Button98 onClick={onClose} disabled={creating}>
            Cancel
          </Button98>
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
