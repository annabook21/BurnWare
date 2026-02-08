/**
 * Buddy Context Menu
 * Win98-style right-click menu for buddy list items
 */

import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

interface ContextMenuProps {
  x: number;
  y: number;
  hasMessages: boolean;
  onOpenThreads: () => void;
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

  &:hover {
    background: ${aimTheme.colors.blue};
    color: ${aimTheme.colors.white};
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
  onGetBuddyInfo,
  onEditDescription,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <MenuOverlay onClick={onClose}>
      <Menu ref={menuRef} $x={x} $y={y} onClick={(e) => e.stopPropagation()}>
        <MenuItem
          onClick={() => { onOpenThreads(); onClose(); }}
          style={!hasMessages ? { color: aimTheme.colors.darkGray } : undefined}
        >
          Send an Instant Message
        </MenuItem>
        <MenuItem onClick={() => { onGetBuddyInfo(); onClose(); }}>
          Get Buddy Info
        </MenuItem>
        <MenuItem onClick={() => { onEditDescription(); onClose(); }}>
          Edit Away Message
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={() => { onDelete(); onClose(); }}>
          Delete Buddy
        </MenuItem>
      </Menu>
    </MenuOverlay>
  );
};
