/**
 * Confirm Dialog Component
 * Classic Windows-style confirmation dialog
 * File size: ~130 lines
 */

import React from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
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
  height: 100%;
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
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  line-height: 1.4;
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  justify-content: center;
  padding: ${aimTheme.spacing.md};
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

  &:focus {
    outline: 1px dotted ${aimTheme.colors.black};
    outline-offset: -4px;
  }
`;

const ConfirmButton = styled(Button)`
  font-weight: ${aimTheme.fonts.weight.bold};
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
  return (
    <WindowFrame title={title} width={360} height={180} initialX={250} initialY={200} zIndex={2000}>
      <DialogContainer>
        <MessageArea>
          <Icon>{icon}</Icon>
          <MessageText>{message}</MessageText>
        </MessageArea>
        <ButtonBar>
          <ConfirmButton onClick={onConfirm}>{confirmText}</ConfirmButton>
          <Button onClick={onCancel}>{cancelText}</Button>
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
