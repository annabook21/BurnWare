/**
 * Sound Manager Component
 * Controls for AIM sound effects
 * File size: ~90 lines
 */

import React from 'react';
import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

interface SoundManagerProps {
  muted: boolean;
  onToggleMute: () => void;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
  padding: ${aimTheme.spacing.sm};
  background: ${aimTheme.colors.gray};
  border-top: 1px solid ${aimTheme.colors.darkGray};
  font-size: ${aimTheme.fonts.size.small};
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
  cursor: pointer;
  user-select: none;
`;

const Checkbox = styled.input`
  cursor: pointer;
`;

const SoundIcon = styled.span`
  font-size: 14px;
`;

export const SoundManager: React.FC<SoundManagerProps> = ({ muted, onToggleMute }) => {
  return (
    <Container>
      <CheckboxLabel>
        <Checkbox type="checkbox" checked={!muted} onChange={onToggleMute} />
        <SoundIcon>{muted ? '🔇' : '🔊'}</SoundIcon>
        <span>Sound Effects</span>
      </CheckboxLabel>
    </Container>
  );
};
