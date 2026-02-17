/**
 * Character Counter Component
 * Shows remaining/max characters with warning color near limit
 */

import React from 'react';
import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

interface CharCounterProps {
  current: number;
  max: number;
  warningThreshold?: number; // 0-1, default 0.9
}

const Count = styled.div<{ $warning: boolean }>`
  font-size: ${aimTheme.fonts.size.tiny};
  color: ${(p) => (p.$warning ? aimTheme.colors.fireRed : aimTheme.colors.darkGray)};
  text-align: right;
  margin-top: 2px;
`;

export const CharCounter: React.FC<CharCounterProps> = ({ current, max, warningThreshold = 0.9 }) => {
  const remaining = max - current;
  const isWarning = current >= max * warningThreshold;
  return <Count $warning={isWarning}>{remaining}/{max}</Count>;
};
