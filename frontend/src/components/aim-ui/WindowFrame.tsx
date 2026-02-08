/**
 * Window Frame Component
 * Reusable draggable window with AIM styling
 * File size: ~175 lines
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Draggable from 'react-draggable';
import { TitleBar } from './TitleBar';
import { aimTheme } from '../../theme/aim-theme';

interface WindowFrameProps {
  title: string;
  width?: number;
  height?: number;
  initialX?: number;
  initialY?: number;
  icon?: string;
  onClose?: () => void;
  children: React.ReactNode;
  zIndex?: number;
  onFocus?: () => void;
}

const WindowContainer = styled.div<{ width: number; height: number; zIndex: number }>`
  position: fixed;
  top: 0;
  left: 0;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  box-shadow: ${aimTheme.shadows.window};
  display: flex;
  flex-direction: column;
  z-index: ${(props) => props.zIndex};
  font-family: ${aimTheme.fonts.primary};
`;

const WindowContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export const WindowFrame: React.FC<WindowFrameProps> = ({
  title,
  width = 400,
  height = 300,
  initialX = 100,
  initialY = 100,
  icon,
  onClose,
  children,
  zIndex = aimTheme.zIndex.window,
  onFocus,
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });

  useEffect(() => {
    setPosition({ x: initialX, y: initialY });
  }, [initialX, initialY]);

  const TASKBAR_H = 28;
  const bounds = {
    left: 0,
    top: 0,
    right: Math.max(0, window.innerWidth - width),
    bottom: Math.max(0, window.innerHeight - TASKBAR_H - height),
  };

  const handleDrag = (_e: unknown, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  const handleMouseDown = () => {
    if (onFocus) {
      onFocus();
    }
  };

  return (
    <Draggable
      handle=".window-title-bar"
      position={position}
      onDrag={handleDrag}
      bounds={bounds}
    >
      <WindowContainer
        width={width}
        height={height}
        zIndex={zIndex}
        onMouseDown={handleMouseDown}
      >
        <TitleBar title={title} icon={icon} onClose={onClose} />
        <WindowContent>{children}</WindowContent>
      </WindowContainer>
    </Draggable>
  );
};
