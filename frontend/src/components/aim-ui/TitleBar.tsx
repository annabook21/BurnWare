/**
 * Title Bar Component
 * Classic AIM window title bar with controls
 * File size: ~120 lines
 */

import React from 'react';
import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

interface TitleBarProps {
  title: string;
  icon?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

const TitleBarContainer = styled.div`
  background: linear-gradient(
    to right,
    ${aimTheme.colors.blueGradientStart},
    ${aimTheme.colors.blueGradientEnd}
  );
  color: ${aimTheme.colors.white};
  font-weight: ${aimTheme.fonts.weight.bold};
  padding: 3px 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
  height: 24px;
  font-size: ${aimTheme.fonts.size.normal};
`;

const TitleContent = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TitleIcon = styled.img`
  width: 16px;
  height: 16px;
  object-fit: contain;
`;

const TitleText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Controls = styled.div`
  display: flex;
  gap: 2px;
`;

const ControlButton = styled.button`
  width: 16px;
  height: 14px;
  border: 1px outset ${aimTheme.colors.gray};
  background: ${aimTheme.colors.gray};
  color: ${aimTheme.colors.black};
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;

  &:active {
    border-style: inset;
  }

  &:hover {
    background: #D0D0D0;
  }
`;

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  icon = '/burnware-logo.png',
  onClose,
  onMinimize,
  onMaximize,
}) => {
  return (
    <TitleBarContainer className="window-title-bar">
      <TitleContent>
        <TitleIcon src={icon} alt="" />
        <TitleText>{title}</TitleText>
      </TitleContent>
      <Controls>
        {onMinimize && <ControlButton onClick={onMinimize}>_</ControlButton>}
        {onMaximize && <ControlButton onClick={onMaximize}>□</ControlButton>}
        {onClose && <ControlButton onClick={onClose}>×</ControlButton>}
      </Controls>
    </TitleBarContainer>
  );
};
