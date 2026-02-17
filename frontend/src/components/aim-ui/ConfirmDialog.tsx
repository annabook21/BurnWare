/**
 * Confirm Dialog Component
 * Classic Windows-style confirmation dialog
 */

import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { Button98 } from './Button98';
import { aimTheme } from '../../theme/aim-theme';

interface ConfirmDialogProps {
  title: string;
  message: string;
  icon?: '⚠️' | 'ℹ️' | '❓';
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const MessageArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.lg};
  padding: ${aimTheme.spacing.lg};
`;

const Icon = styled.div`
  font-size: 48px;
  line-height: 1;
`;

const MessageText = styled.div`
  font-size: ${aimTheme.fonts.size.normal};
  line-height: 1.4;
`;

const ButtonBarCenter = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  justify-content: center;
  padding: ${aimTheme.spacing.md};
`;

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  icon = '❓',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onConfirm, onCancel]);

  return (
    <WindowFrame title={title} width={360} height={180} initialX={250} initialY={200} zIndex={2000}>
      <DialogContainer role="alertdialog" aria-modal="true" aria-describedby="confirm-msg">
        <MessageArea>
          <Icon>{icon}</Icon>
          <MessageText id="confirm-msg">{message}</MessageText>
        </MessageArea>
        <ButtonBarCenter>
          <Button98 ref={confirmRef} onClick={onConfirm} style={{ fontWeight: 'bold' }}>{confirmText}</Button98>
          <Button98 onClick={onCancel}>{cancelText}</Button98>
        </ButtonBarCenter>
      </DialogContainer>
    </WindowFrame>
  );
};
