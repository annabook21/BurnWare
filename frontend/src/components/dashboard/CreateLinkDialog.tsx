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
  onSave: (data: {
    display_name: string;
    description?: string;
    expires_in_days?: number;
    opsec_mode?: boolean;
    opsec_access?: 'device_bound' | 'single_use';
    opsec_passphrase?: string;
  }) => void;
  onClose: () => void;
}

/** Scrollable body so Expires In + OPSEC + buttons aren't clipped. WindowFrame's content area uses overflow:hidden so without this the bottom of the form was cut off. min-height:0 lets the flex child shrink and show a scrollbar. */
const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
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

const Fieldset = styled.fieldset`
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  margin-bottom: ${aimTheme.spacing.lg};
`;

const Legend = styled.legend`
  font-weight: ${aimTheme.fonts.weight.bold};
  padding: 0 ${aimTheme.spacing.sm};
`;

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
  cursor: pointer;
  margin-bottom: ${aimTheme.spacing.sm};
`;

const RadioGroup = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.lg};
  margin: ${aimTheme.spacing.sm} 0;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: ${aimTheme.fonts.size.small};
`;

export const CreateLinkDialog: React.FC<CreateLinkDialogProps> = ({ onSave, onClose }) => {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | undefined>(30);
  const [opsecMode, setOpsecMode] = useState(false);
  const [opsecAccess, setOpsecAccess] = useState<'device_bound' | 'single_use'>('device_bound');
  const [opsecPassphrase, setOpsecPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  const handleCreate = () => {
    if (!displayName.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    if (opsecMode && opsecPassphrase && opsecPassphrase.length < 4) {
      toast.error('Passphrase must be at least 4 characters');
      return;
    }

    onSave({
      display_name: displayName.trim(),
      description: description.trim() || undefined,
      expires_in_days: expiresIn,
      ...(opsecMode && {
        opsec_mode: true,
        opsec_access: opsecAccess,
        opsec_passphrase: opsecPassphrase || undefined,
      }),
    });
  };

  return (
    <WindowFrame
      title="✨ Create New Link"
      width={420}
      height={opsecMode ? 560 : 480}
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
          <div style={{ fontSize: aimTheme.fonts.size.tiny, color: aimTheme.colors.darkGray, marginTop: 2 }}>
            Senders will see this when they open the link.
          </div>
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

        <Fieldset>
          <Legend>OPSEC Mode</Legend>
          <Checkbox>
            <input type="checkbox" checked={opsecMode} onChange={(e) => setOpsecMode(e.target.checked)} />
            Enable OPSEC Mode (24h expiry, access control)
          </Checkbox>
          {opsecMode && (
            <>
              <RadioGroup>
                <RadioLabel>
                  <input type="radio" name="opsec_access" value="device_bound"
                    checked={opsecAccess === 'device_bound'} onChange={() => setOpsecAccess('device_bound')} />
                  Device-bound
                </RadioLabel>
                <RadioLabel>
                  <input type="radio" name="opsec_access" value="single_use"
                    checked={opsecAccess === 'single_use'} onChange={() => setOpsecAccess('single_use')} />
                  Single-use (session)
                </RadioLabel>
              </RadioGroup>
              <Field>
                <Label>Passphrase (optional)</Label>
                <div style={{ display: 'flex', gap: aimTheme.spacing.sm }}>
                  <Input
                    type={showPassphrase ? 'text' : 'password'}
                    value={opsecPassphrase}
                    onChange={(e) => setOpsecPassphrase(e.target.value.slice(0, 128))}
                    placeholder="Leave blank for no passphrase"
                    maxLength={128}
                  />
                  <Button type="button" onClick={() => setShowPassphrase(!showPassphrase)} style={{ minWidth: 50 }}>
                    {showPassphrase ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </Field>
            </>
          )}
        </Fieldset>

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
