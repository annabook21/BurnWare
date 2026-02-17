/**
 * Sound Manager Component
 * Controls for AIM sound effects
 * File size: ~35 lines
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

export const SoundManager: React.FC<SoundManagerProps> = ({ muted, onToggleMute }) => {
  return (
    <Container>
      <div className="field-row">
        <input id="sound-toggle" type="checkbox" checked={!muted} onChange={onToggleMute} />
        <label htmlFor="sound-toggle">{muted ? '🔇' : '🔊'} Sound Effects</label>
      </div>
    </Container>
  );
};
