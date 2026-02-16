/**
 * Window Frame Component
 * Reusable draggable + resizable window with AIM styling
 * File size: ~175 lines
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const MIN_W = 280;
const MIN_H = 200;
const TASKBAR_H = 28;

const WindowContainer = styled.div<{ $w: number; $h: number; $z: number }>`
  position: fixed;
  top: 0;
  left: 0;
  width: ${(p) => p.$w}px;
  height: ${(p) => p.$h}px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  box-shadow: ${aimTheme.shadows.window};
  display: flex;
  flex-direction: column;
  z-index: ${(p) => p.$z};
  font-family: ${aimTheme.fonts.primary};
`;

const WindowContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const ResizeHandle = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;

  /* Win98-style diagonal grip lines */
  &::after {
    content: '';
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 10px;
    height: 10px;
    background:
      linear-gradient(
        135deg,
        transparent 30%,
        ${aimTheme.colors.darkGray} 30%,
        ${aimTheme.colors.darkGray} 40%,
        transparent 40%,
        transparent 55%,
        ${aimTheme.colors.darkGray} 55%,
        ${aimTheme.colors.darkGray} 65%,
        transparent 65%,
        transparent 80%,
        ${aimTheme.colors.darkGray} 80%,
        ${aimTheme.colors.darkGray} 90%,
        transparent 90%
      );
  }
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
  const [size, setSize] = useState({ w: width, h: height });
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    setPosition({ x: initialX, y: initialY });
  }, [initialX, initialY]);

  const bounds = {
    left: 0,
    top: 0,
    right: Math.max(0, window.innerWidth - size.w),
    bottom: Math.max(0, window.innerHeight - TASKBAR_H - size.h),
  };

  const handleDrag = (_e: unknown, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  const handleMouseDown = () => {
    onFocus?.();
  };

  // Resize via pointer events on the grip handle
  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
  }, [size]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const { startX, startY, startW, startH } = resizeRef.current;
    setSize({
      w: Math.max(MIN_W, startW + (e.clientX - startX)),
      h: Math.max(MIN_H, startH + (e.clientY - startY)),
    });
  }, []);

  const onResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  return (
    <Draggable
      handle=".window-title-bar"
      position={position}
      onDrag={handleDrag}
      bounds={bounds}
    >
      <WindowContainer
        $w={size.w}
        $h={size.h}
        $z={zIndex}
        onMouseDown={handleMouseDown}
      >
        <TitleBar title={title} icon={icon} onClose={onClose} />
        <WindowContent>{children}</WindowContent>
        <ResizeHandle
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
        />
      </WindowContainer>
    </Draggable>
  );
};
