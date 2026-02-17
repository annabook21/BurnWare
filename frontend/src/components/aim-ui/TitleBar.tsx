/**
 * Title Bar Component
 * Classic AIM window title bar with 98.css controls
 * File size: ~75 lines
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

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  icon = '/burnware-logo.png',
  onClose,
  onMinimize,
  onMaximize,
}) => {
  return (
    <TitleBarContainer className="title-bar window-title-bar">
      <TitleContent className="title-bar-text">
        <TitleIcon src={icon} alt="" />
        <TitleText>{title}</TitleText>
      </TitleContent>
      <div className="title-bar-controls">
        {onMinimize && <button aria-label="Minimize" onClick={onMinimize} />}
        {onMaximize && <button aria-label="Maximize" onClick={onMaximize} />}
        {onClose && <button aria-label="Close" onClick={onClose} />}
      </div>
    </TitleBarContainer>
  );
};
