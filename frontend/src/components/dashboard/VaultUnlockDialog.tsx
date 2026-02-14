/**
 * Vault Unlock Dialog
 * Two modes:
 *   - setup: first-time passphrase creation (also triggers vault migration)
 *   - unlock: returning user enters passphrase to decrypt keys
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import { toast } from 'sonner';
import { setupVault, initializeVault } from '../../utils/key-vault';
import { migrateKeysToVault } from '../../utils/key-store';

interface VaultUnlockDialogProps {
  mode: 'setup' | 'unlock';
  onUnlocked: () => void;
  onSkip: () => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const Message = styled.p`
  margin: 0 0 ${aimTheme.spacing.md};
  font-size: ${aimTheme.fonts.size.normal};
  line-height: 1.4;
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
  margin-bottom: ${aimTheme.spacing.md};

  &:focus {
    outline: none;
  }
`;

const ErrorText = styled.p`
  color: ${aimTheme.colors.fireRed};
  font-size: ${aimTheme.fonts.size.small};
  margin: 0 0 ${aimTheme.spacing.sm};
`;

const ProgressText = styled.p`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin: 0 0 ${aimTheme.spacing.sm};
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

const PrimaryButton = styled(Button)`
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-weight: bold;
  text-shadow: ${aimTheme.shadows.text};
`;

export const VaultUnlockDialog: React.FC<VaultUnlockDialogProps> = ({
  mode,
  onUnlocked,
  onSkip,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [working, setWorking] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (mode === 'setup') {
      if (passphrase.length < 4) {
        setError('Passphrase must be at least 4 characters.');
        return;
      }
      if (passphrase !== confirmPassphrase) {
        setError('Passphrases do not match.');
        return;
      }
    }

    setWorking(true);
    try {
      if (mode === 'setup') {
        setProgress('Creating vault...');
        await setupVault(passphrase);
        setProgress('Encrypting existing keys...');
        const count = await migrateKeysToVault();
        toast.success(`Vault created. ${count} key${count !== 1 ? 's' : ''} encrypted.`);
      } else {
        setProgress('Unlocking vault...');
        await initializeVault(passphrase);
        toast.success('Vault unlocked.');
      }
      onUnlocked();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'Incorrect passphrase') {
        setError('Incorrect passphrase. Please try again.');
      } else {
        setError(`Failed: ${msg}`);
      }
      setWorking(false);
      setProgress('');
    }
  };

  const title = mode === 'setup' ? 'Secure Your Keys' : 'Unlock Vault';
  const description = mode === 'setup'
    ? 'Set a passphrase to encrypt your private keys on this device. This is the same passphrase used for key backup recovery.'
    : 'Enter your recovery passphrase to unlock your encryption keys for this session.';

  return (
    <WindowFrame
      title={title}
      width={400}
      height={mode === 'setup' ? 360 : 280}
      initialX={180}
      initialY={120}
      zIndex={1003}
      onClose={onSkip}
    >
      <Container>
        <Message>{description}</Message>
        <Label>{mode === 'setup' ? 'New Passphrase' : 'Recovery Passphrase'}</Label>
        <Input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={mode === 'setup' ? 'At least 4 characters' : 'Enter passphrase'}
          disabled={working}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && mode === 'unlock') handleSubmit();
          }}
        />
        {mode === 'setup' && (
          <>
            <Label>Confirm Passphrase</Label>
            <Input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Repeat passphrase"
              disabled={working}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        {progress && <ProgressText>{progress}</ProgressText>}
        <ButtonBar>
          <PrimaryButton onClick={handleSubmit} disabled={!passphrase || working}>
            {working ? (mode === 'setup' ? 'Creating...' : 'Unlocking...') : (mode === 'setup' ? 'Create Vault' : 'Unlock')}
          </PrimaryButton>
          <Button onClick={onSkip} disabled={working}>Skip</Button>
        </ButtonBar>
      </Container>
    </WindowFrame>
  );
};
