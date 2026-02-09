/**
 * Key Recovery Dialog
 * Passphrase-based recovery of encrypted private keys from server backup
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { unwrapPrivateKey } from '../../utils/e2ee';
import { saveLinkKey } from '../../utils/key-store';

interface KeyRecoveryDialogProps {
  linkId: string;
  linkName: string;
  onRecovered: () => void;
  onClose: () => void;
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

const RecoverButton = styled(Button)`
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-weight: bold;
  text-shadow: ${aimTheme.shadows.text};
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
      width={380}
      height={260}
      initialX={200}
      initialY={150}
      zIndex={1002}
      onClose={onClose}
    >
      <Container>
        <Message>
          Your encryption key for <strong>{linkName}</strong> is missing from this browser.
          Enter your recovery passphrase to restore it.
        </Message>
        <Input
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
          <RecoverButton onClick={handleRecover} disabled={!passphrase || recovering}>
            {recovering ? 'Recovering...' : 'Recover Key'}
          </RecoverButton>
          <Button onClick={onClose}>Cancel</Button>
        </ButtonBar>
      </Container>
    </WindowFrame>
  );
};
