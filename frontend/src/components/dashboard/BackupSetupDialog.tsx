/**
 * Backup Setup Dialog
 * Prompts user to set a recovery passphrase and backs up all existing keys
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { Button98, PrimaryButton } from '../aim-ui/Button98';
import { FieldLabel, ButtonBar, FullInput } from '../aim-ui/FormField';
import { aimTheme } from '../../theme/aim-theme';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { wrapPrivateKey } from '../../utils/e2ee';
import { getAllLinkKeys, migrateKeysToVault } from '../../utils/key-store';
import { isVaultConfigured, setupVault } from '../../utils/key-vault';

interface BackupSetupDialogProps {
  linkIds: string[];
  onComplete: () => void;
  onClose: () => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const Message = styled.p`
  margin: 0 0 ${aimTheme.spacing.md};
  font-size: ${aimTheme.fonts.size.normal};
  line-height: 1.4;
`;

const InputWithMargin = styled(FullInput)`
  margin-bottom: ${aimTheme.spacing.md};
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

export const BackupSetupDialog: React.FC<BackupSetupDialogProps> = ({
  linkIds,
  onComplete,
  onClose,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [backing, setBacking] = useState(false);

  const handleBackup = async () => {
    setError('');
    if (passphrase.length < 4) {
      setError('Passphrase must be at least 4 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }

    setBacking(true);
    try {
      const allKeys = await getAllLinkKeys();
      const token = await getAccessToken();
      const keysToBackup = linkIds.filter((id) => allKeys.has(id));
      let backed = 0;

      for (const id of keysToBackup) {
        const jwk = allKeys.get(id)!;
        setProgress(`Backing up key ${backed + 1} of ${keysToBackup.length}...`);
        const wrapped = await wrapPrivateKey(jwk, passphrase);
        await apiClient.put(
          endpoints.dashboard.keyBackup(id),
          { wrapped_key: wrapped.wrappedKey, salt: wrapped.salt, iv: wrapped.iv },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        backed++;
      }

      localStorage.setItem('bw:backup-configured', 'true');

      // Also initialize the local vault with the same passphrase
      const vaultConfigured = await isVaultConfigured();
      if (!vaultConfigured) {
        await setupVault(passphrase);
        await migrateKeysToVault();
      }

      toast.success(`${backed} key${backed !== 1 ? 's' : ''} backed up successfully.`);
      onComplete();
    } catch (err) {
      console.error('Backup failed:', err);
      setError('Backup failed. Please try again.');
      setBacking(false);
    }
  };

  return (
    <WindowFrame
      title="Key Backup Setup"
      width={420}
      height={400}
      initialX={160}
      initialY={80}
      zIndex={1002}
      onClose={onClose}
    >
      <Container>
        <Message>
          Set a recovery passphrase to protect your encryption keys.
          If you ever lose access to this browser, you can recover your keys
          using this passphrase.
        </Message>
        <FieldLabel>Recovery Passphrase</FieldLabel>
        <InputWithMargin
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="At least 4 characters"
          disabled={backing}
          autoFocus
        />
        <FieldLabel>Confirm Passphrase</FieldLabel>
        <InputWithMargin
          type="password"
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
          placeholder="Repeat passphrase"
          disabled={backing}
          onKeyDown={(e) => e.key === 'Enter' && handleBackup()}
        />
        {error && <ErrorText>{error}</ErrorText>}
        {progress && <ProgressText>{progress}</ProgressText>}
        <ButtonBar>
          <PrimaryButton onClick={handleBackup} disabled={!passphrase || backing}>
            {backing ? 'Backing up...' : 'Backup Keys'}
          </PrimaryButton>
          <Button98 onClick={onClose} disabled={backing}>Skip</Button98>
        </ButtonBar>
      </Container>
    </WindowFrame>
  );
};
