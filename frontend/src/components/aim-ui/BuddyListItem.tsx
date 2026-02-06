/**
 * Buddy List Item Component
 * Individual link item in the links list
 * File size: ~95 lines
 */

import React from 'react';
import styled from 'styled-components';
import { StatusIndicator } from './StatusIndicator';
import { aimTheme } from '../../theme/aim-theme';

import type { StatusType } from '../../types';

interface BuddyListItemProps {
  name: string;
  status: StatusType;
  messageCount?: number;
  onClick: () => void;
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

const MessageBadge = styled.span`
  background: ${aimTheme.colors.brandOrange};
  color: ${aimTheme.colors.white};
  border-radius: 10px;
  padding: 2px 6px;
  font-size: ${aimTheme.fonts.size.tiny};
  font-weight: ${aimTheme.fonts.weight.bold};
  min-width: 18px;
  text-align: center;
`;

export const BuddyListItem: React.FC<BuddyListItemProps> = ({
  name,
  status,
  messageCount = 0,
  onClick,
}) => {
  return (
    <ItemContainer status={status} onClick={onClick}>
      <ItemLeft>
        <StatusIndicator status={status} size={14} />
        <ItemName>{name}</ItemName>
      </ItemLeft>
      {messageCount > 0 && <MessageBadge>{messageCount}</MessageBadge>}
    </ItemContainer>
  );
};
