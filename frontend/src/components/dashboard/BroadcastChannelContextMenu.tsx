/**
 * Broadcast Channel Context Menu
 * Right-click menu for channel items: Open, Copy link, Show QR, Burn
 */

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';
import type { BroadcastChannel } from '../../types';

interface BroadcastChannelContextMenuProps {
  x: number;
  y: number;
  channel: BroadcastChannel;
  postToken: string | undefined;
  onOpen: () => void;
  onCopyLink: () => void;
  onShowQR: () => void;
  onBurn: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const MenuOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10001;
`;

const Menu = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${(p) => p.$x}px;
  top: ${(p) => p.$y}px;
  background: ${aimTheme.colors.gray};
  border: 2px outset ${aimTheme.colors.gray};
  min-width: 160px;
  padding: 2px;
  z-index: 10002;
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
`;

const MenuItem = styled.button<{ $danger?: boolean }>`
  display: block;
  width: 100%;
  padding: 4px 12px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  color: ${(p) => (p.$danger ? '#c00' : 'inherit')};

  &:hover {
    background: ${aimTheme.colors.blue};
    color: ${aimTheme.colors.white};
  }
`;

export const BroadcastChannelContextMenu: React.FC<BroadcastChannelContextMenuProps> = ({
  x,
  y,
  channel,
  postToken,
  onOpen,
  onCopyLink,
  onShowQR,
  onBurn,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  // Viewport bounds
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clampedX = Math.min(x, window.innerWidth - rect.width - 4);
    const clampedY = Math.min(y, window.innerHeight - rect.height - 4);
    setPos({ x: Math.max(0, clampedX), y: Math.max(0, clampedY) });
  }, [x, y]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

      e.preventDefault();
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      if (!items || items.length === 0) return;
      const idx = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') items[(idx + 1) % items.length].focus();
      else items[(idx - 1 + items.length) % items.length].focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <MenuOverlay
        role="presentation"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      <Menu
        ref={menuRef}
        $x={pos.x}
        $y={pos.y}
        role="menu"
        aria-label="Channel actions"
        tabIndex={-1}
      >
        {!channel.burned && (
          <>
            <MenuItem ref={firstItemRef} type="button" role="menuitem" onClick={onOpen}>
              Open
            </MenuItem>
            <MenuItem type="button" role="menuitem" onClick={onCopyLink}>
              Copy read link
            </MenuItem>
            <MenuItem type="button" role="menuitem" onClick={onShowQR}>
              Show QR
            </MenuItem>
            {postToken && (
              <MenuItem type="button" role="menuitem" $danger onClick={onBurn}>
                Burn channel
              </MenuItem>
            )}
            <MenuItem type="button" role="menuitem" $danger onClick={onDelete}>
              Delete channel
            </MenuItem>
          </>
        )}
        {channel.burned && (
          <MenuItem ref={firstItemRef} type="button" role="menuitem" $danger onClick={onDelete}>
            Delete channel
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
