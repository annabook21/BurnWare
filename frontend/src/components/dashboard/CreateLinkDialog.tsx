/**
 * Create Link Dialog Component
 * Dialog for creating new anonymous links
 * File size: ~180 lines
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { Button98, PrimaryButton } from '../aim-ui/Button98';
import { Field, FieldLabel, FullInput, FullTextArea, FullSelect, ButtonBar } from '../aim-ui/FormField';
import { CharCounter } from '../aim-ui/CharCounter';
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

/** flex:1 + min-height:0 lets this fill the WindowContent flex parent and scroll when content overflows. height:100% doesn't resolve in a flex parent whose height comes from flex:1. */
const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
  padding-bottom: ${aimTheme.spacing.xl};
`;

const Fieldset = styled.fieldset`
  box-shadow: var(--border-field);
  border: none;
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  margin-bottom: ${aimTheme.spacing.lg};
`;

const Legend = styled.legend`
  font-weight: ${aimTheme.fonts.weight.bold};
  padding: 0 ${aimTheme.spacing.sm};
`;

/** Wrapper for checkbox so 98.css can show the box (it expects input + label as siblings in a field-row) */
const FieldRow = styled.div`
  margin-bottom: ${aimTheme.spacing.sm};
`;

const RadioGroup = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.lg};
  margin: ${aimTheme.spacing.sm} 0;
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
      width={500}
      height={700}
      initialX={100}
      initialY={40}
      zIndex={1001}
      onClose={onClose}
    >
      <DialogContainer>
        <Field>
          <FieldLabel>Display Name *</FieldLabel>
          <FullInput
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
            placeholder="e.g., Work Feedback"
            maxLength={100}
            autoFocus
          />
          <CharCounter current={displayName.length} max={100} />
          <div style={{ fontSize: aimTheme.fonts.size.tiny, color: aimTheme.colors.darkGray, marginTop: 2 }}>
            Senders will see this when they open the link.
          </div>
        </Field>

        <Field>
          <FieldLabel>Description (Optional)</FieldLabel>
          <FullTextArea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Let people know what this link is for..."
            maxLength={500}
          />
          <CharCounter current={description.length} max={500} />
        </Field>

        <Field>
          <FieldLabel>Expires In</FieldLabel>
          <FullSelect value={expiresIn} onChange={(e) => setExpiresIn(Number(e.target.value) || undefined)}>
            <option value="">Never</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </FullSelect>
        </Field>

        <Fieldset>
          <Legend>OPSEC Mode</Legend>
          <FieldRow className="field-row">
            <input
              id="create-link-opsec"
              type="checkbox"
              checked={opsecMode}
              onChange={(e) => setOpsecMode(e.target.checked)}
            />
            <label htmlFor="create-link-opsec">
              Enable OPSEC Mode (24h expiry, access control)
            </label>
          </FieldRow>
          {opsecMode && (
            <>
              <RadioGroup>
                <FieldRow className="field-row">
                  <input
                    id="opsec-device-bound"
                    type="radio"
                    name="opsec_access"
                    value="device_bound"
                    checked={opsecAccess === 'device_bound'}
                    onChange={() => setOpsecAccess('device_bound')}
                  />
                  <label htmlFor="opsec-device-bound">Device-bound</label>
                </FieldRow>
                <FieldRow className="field-row">
                  <input
                    id="opsec-single-use"
                    type="radio"
                    name="opsec_access"
                    value="single_use"
                    checked={opsecAccess === 'single_use'}
                    onChange={() => setOpsecAccess('single_use')}
                  />
                  <label htmlFor="opsec-single-use">Single-use (session)</label>
                </FieldRow>
              </RadioGroup>
              <Field>
                <FieldLabel>Passphrase (optional)</FieldLabel>
                <div style={{ display: 'flex', gap: aimTheme.spacing.sm }}>
                  <FullInput
                    type={showPassphrase ? 'text' : 'password'}
                    value={opsecPassphrase}
                    onChange={(e) => setOpsecPassphrase(e.target.value.slice(0, 128))}
                    placeholder="Leave blank for no passphrase"
                    maxLength={128}
                  />
                  <Button98 type="button" onClick={() => setShowPassphrase(!showPassphrase)} style={{ minWidth: 50 }}>
                    {showPassphrase ? 'Hide' : 'Show'}
                  </Button98>
                </div>
                <CharCounter current={opsecPassphrase.length} max={128} />
              </Field>
            </>
          )}
        </Fieldset>

        <ButtonBar>
          <PrimaryButton onClick={handleCreate} disabled={!displayName.trim()}>
            🔥 Create
          </PrimaryButton>
          <Button98 onClick={onClose}>Cancel</Button98>
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
