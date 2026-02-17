/**
 * Buddy List Item Component
 * Individual link item in the links list
 * File size: ~95 lines
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { StatusIndicator } from './StatusIndicator';
import { aimTheme } from '../../theme/aim-theme';

import type { StatusType } from '../../types';

interface BuddyListItemProps {
  name: string;
  status: StatusType;
  messageCount?: number;
  hasNewMessages?: boolean;
  isRoom?: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const ItemContainer = styled.div<{ status: StatusType }>`
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: ${aimTheme.fonts.size.normal};
  color: ${(props) => (props.status === 'expired' ? aimTheme.colors.expired : aimTheme.colors.black)};
  font-style: ${(props) => (props.status === 'expired' ? 'italic' : 'normal')};

  &:hover {
    background: ${aimTheme.colors.blue};
    color: ${aimTheme.colors.white};
  }
`;

const ItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
`;

const ItemName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const badgePulse = keyframes`
  0%, 100% { transform: scale(1); background: ${aimTheme.colors.brandOrange}; }
  50% { transform: scale(1.3); background: #FF3333; }
`;

const MessageBadge = styled.span<{ $pulsing?: boolean }>`
  background: ${aimTheme.colors.brandOrange};
  color: ${aimTheme.colors.white};
  border-radius: 10px;
  padding: 2px 6px;
  font-size: ${aimTheme.fonts.size.tiny};
  font-weight: ${aimTheme.fonts.weight.bold};
  min-width: 18px;
  text-align: center;
  ${(props) => props.$pulsing && `animation: ${badgePulse} 1s ease-in-out infinite;`}
`;

const RoomIcon = styled.span<{ $expired?: boolean }>`
  font-size: 12px;
  opacity: ${(props) => (props.$expired ? 0.5 : 1)};
`;

export const BuddyListItem: React.FC<BuddyListItemProps> = React.memo(({
  name,
  status,
  messageCount = 0,
  hasNewMessages = false,
  isRoom = false,
  onClick,
  onDoubleClick,
  onContextMenu,
}) => {
  return (
    <ItemContainer status={status} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      <ItemLeft>
        {isRoom ? (
          <RoomIcon $expired={status === 'expired'} aria-label="Secure room">🔒</RoomIcon>
        ) : (
          <StatusIndicator status={status} size={14} />
        )}
        <ItemName title={name}>{name}</ItemName>
      </ItemLeft>
      {messageCount > 0 && (
        <MessageBadge $pulsing={hasNewMessages}>
          {isRoom ? `👥${messageCount}` : messageCount}
        </MessageBadge>
      )}
    </ItemContainer>
  );
});
