/**
 * Create Link Dialog Component
 * Dialog for creating new anonymous links
 * File size: ~180 lines
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';

interface CreateLinkDialogProps {
  onSave: (data: { display_name: string; description?: string; expires_in_days?: number }) => void;
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

  &:focus {
    outline: none;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 80px;
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

export const CreateLinkDialog: React.FC<CreateLinkDialogProps> = ({ onSave, onClose }) => {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | undefined>(30);

  const handleCreate = () => {
    if (!displayName.trim()) {
      toast.error('Please enter a display name');
      return;
    }

    onSave({
      display_name: displayName.trim(),
      description: description.trim() || undefined,
      expires_in_days: expiresIn,
    });
  };

  return (
    <WindowFrame
      title="✨ Create New Link"
      width={420}
      height={400}
      initialX={150}
      initialY={100}
      zIndex={1001}
      onClose={onClose}
    >
      <DialogContainer>
        <Field>
          <Label>Display Name *</Label>
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
            placeholder="e.g., Work Feedback"
            maxLength={100}
            autoFocus
          />
        </Field>

        <Field>
          <Label>Description (Optional)</Label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Let people know what this link is for..."
            maxLength={500}
          />
        </Field>

        <Field>
          <Label>Expires In</Label>
          <Select value={expiresIn} onChange={(e) => setExpiresIn(Number(e.target.value) || undefined)}>
            <option value="">Never</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </Select>
        </Field>

        <ButtonBar>
          <CreateButton onClick={handleCreate} disabled={!displayName.trim()}>
            🔥 Create
          </CreateButton>
          <Button onClick={onClose}>Cancel</Button>
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
