/**
 * Buddy Context Menu
 * Win98-style right-click menu for buddy list items
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

interface ContextMenuProps {
  x: number;
  y: number;
  hasMessages: boolean;
  onOpenThreads: () => void;
  onOpenSendPage?: () => void;
  onGetBuddyInfo: () => void;
  onEditDescription: () => void;
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
  min-width: 200px;
  padding: 2px;
  z-index: 10002;
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
`;

const MenuItem = styled.button`
  display: block;
  width: 100%;
  padding: 4px 24px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};

  &:hover, &:focus {
    background: ${aimTheme.colors.blue};
    color: ${aimTheme.colors.white};
    outline: none;
  }
`;

const MenuDivider = styled.hr`
  border: none;
  border-top: 1px solid ${aimTheme.colors.darkGray};
  border-bottom: 1px solid ${aimTheme.colors.white};
  margin: 2px 4px;
`;

export const BuddyContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  hasMessages,
  onOpenThreads,
  onOpenSendPage,
  onGetBuddyInfo,
  onEditDescription,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Viewport bounds: clamp menu to viewport after mount
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clampedX = Math.min(x, window.innerWidth - rect.width - 4);
    const clampedY = Math.min(y, window.innerHeight - rect.height - 4);
    setPos({ x: Math.max(0, clampedX), y: Math.max(0, clampedY) });
  }, [x, y]);

  // AutoFocus first item
  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;

    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;

    if (e.key === 'Enter') return; // Let native click handle it

    e.preventDefault();
    const active = document.activeElement as HTMLElement;
    const idx = Array.from(items).indexOf(active as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      items[(idx - 1 + items.length) % items.length].focus();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <MenuOverlay
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      <Menu
        ref={menuRef}
        $x={pos.x}
        $y={pos.y}
        role="menu"
        aria-label="Link actions"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          role="menuitem"
          onClick={() => { onOpenThreads(); onClose(); }}
          style={!hasMessages ? { color: aimTheme.colors.darkGray } : undefined}
        >
          {hasMessages ? 'View messages' : 'Send an Instant Message'}
        </MenuItem>
        {onOpenSendPage && (
          <MenuItem role="menuitem" onClick={() => { onOpenSendPage(); onClose(); }}>
            Open send page
          </MenuItem>
        )}
        <MenuItem role="menuitem" onClick={() => { onGetBuddyInfo(); onClose(); }}>
          Get Buddy Info
        </MenuItem>
        <MenuItem role="menuitem" onClick={() => { onEditDescription(); onClose(); }}>
          Edit Away Message
        </MenuItem>
        <MenuDivider />
        <MenuItem role="menuitem" onClick={() => { onDelete(); onClose(); }}>
          Delete Buddy
        </MenuItem>
      </Menu>
    </>
  );
};
