/**
 * Key Recovery Dialog
 * Passphrase-based recovery of encrypted private keys from server backup
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { Button98, PrimaryButton } from '../aim-ui/Button98';
import { ButtonBar, FullInput } from '../aim-ui/FormField';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { unwrapPrivateKey } from '../../utils/e2ee';
import { saveLinkKey } from '../../utils/key-store';
import { isVaultConfigured, isVaultUnlocked, setupVault, initializeVault } from '../../utils/key-vault';

interface KeyRecoveryDialogProps {
  linkId: string;
  linkName: string;
  onRecovered: () => void;
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

export const KeyRecoveryDialog: React.FC<KeyRecoveryDialogProps> = ({
  linkId,
  linkName,
  onRecovered,
  onClose,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);

  const handleRecover = async () => {
    if (!passphrase) return;
    setError('');
    setRecovering(true);

    try {
      const token = await getAccessToken();
      const res = await apiClient.get(endpoints.dashboard.keyBackup(linkId), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const backup = res.data?.data;
      if (!backup) {
        setError('No backup found for this link.');
        setRecovering(false);
        return;
      }

      const recoveredJwk = await unwrapPrivateKey(
        backup.wrapped_key,
        passphrase,
        backup.salt,
        backup.iv,
      );

      // Ensure vault is unlocked so the recovered key gets stored encrypted
      if (!isVaultUnlocked()) {
        const configured = await isVaultConfigured();
        if (configured) {
          await initializeVault(passphrase);
        } else {
          await setupVault(passphrase);
        }
      }

      await saveLinkKey(linkId, recoveredJwk);
      onRecovered();
    } catch {
      setError('Incorrect recovery passphrase. Please try again.');
      setRecovering(false);
    }
  };

  return (
    <WindowFrame
      title={`Key Recovery - ${linkName}`}
      width={420}
      height={320}
      initialX={160}
      initialY={120}
      zIndex={1002}
      onClose={onClose}
    >
      <Container>
        <Message>
          Your encryption key for <strong>{linkName}</strong> is missing from this browser.
          Enter your recovery passphrase to restore it.
        </Message>
        <InputWithMargin
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Recovery passphrase"
          onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
          autoFocus
          disabled={recovering}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <ButtonBar>
          <PrimaryButton onClick={handleRecover} disabled={!passphrase || recovering}>
            {recovering ? 'Recovering...' : 'Recover Key'}
          </PrimaryButton>
          <Button98 onClick={onClose}>Cancel</Button98>
        </ButtonBar>
      </Container>
    </WindowFrame>
  );
};
