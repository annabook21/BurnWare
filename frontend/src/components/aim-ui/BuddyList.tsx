/**
 * Buddy List Component
 * Main links list window with AIM styling
 * File size: ~240 lines
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { BuddyListItem } from './BuddyListItem';
import { aimTheme } from '../../theme/aim-theme';
import type { Link, StatusType } from '../../types';

interface BuddyListProps {
  links: Link[];
  onLinkClick: (linkId: string) => void;
  onCreateLink: () => void;
  onSettings?: () => void;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
  onFocus?: () => void;
}

const BuddyContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
`;

const Header = styled.div`
  background: linear-gradient(to bottom, #FFFFFF, #E0E0E0);
  border-bottom: 1px solid ${aimTheme.colors.darkGray};
  padding: ${aimTheme.spacing.md};
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.md};
`;

const BrandLogo = styled.img`
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.3));
`;

const HeaderText = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  color: ${aimTheme.colors.brandOrange};
  font-size: ${aimTheme.fonts.size.medium};
`;

const HeaderSubtitle = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
`;

const GroupHeader = styled.button`
  width: 100%;
  background: ${aimTheme.colors.gray};
  border: 1px solid ${aimTheme.colors.darkGray};
  border-left: none;
  border-right: none;
  padding: 2px 8px;
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: ${aimTheme.fonts.weight.bold};
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
  text-align: left;

  &:hover {
    background: #D0D0D0;
  }
`;

const ScrollArea = styled.div`
  background: ${aimTheme.colors.white};
  border: ${aimTheme.borders.inset};
  flex: 1;
  overflow-y: auto;
  margin: ${aimTheme.spacing.sm};
`;

const ActionButtons = styled.div`
  padding: ${aimTheme.spacing.sm};
  display: flex;
  gap: ${aimTheme.spacing.sm};
  border-top: 1px solid ${aimTheme.colors.darkGray};
  background: ${aimTheme.colors.gray};
`;

const Button = styled.button`
  flex: 1;
  padding: 4px 8px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;

  &:active {
    border-style: inset;
  }

  &:focus {
    outline: 1px dotted ${aimTheme.colors.black};
    outline-offset: -4px;
  }
`;

const CreateButton = styled(Button)`
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  font-weight: bold;
  color: ${aimTheme.colors.white};
  text-shadow: ${aimTheme.shadows.text};
`;

const getStatus = (link: Link): StatusType => {
  if (link.burned) return 'expired';
  if (!link.expires_at) return 'active';
  const expiresAt = new Date(link.expires_at);
  const now = new Date();
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry < 7) return 'expiring';
  return 'active';
};

export const BuddyList: React.FC<BuddyListProps> = ({
  links,
  onLinkClick,
  onCreateLink,
  onSettings,
  initialX = 50,
  initialY = 50,
  zIndex = 100,
  onFocus,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['active']));

  const handleLinkClick = useCallback((linkId: string) => {
    onLinkClick(linkId);
  }, [onLinkClick]);

  const activeLinks = links.filter((l) => getStatus(l) === 'active');
  const expiringLinks = links.filter((l) => getStatus(l) === 'expiring');
  const expiredLinks = links.filter((l) => getStatus(l) === 'expired');

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <WindowFrame
      title="🔥 BurnWare - My Anonymous Links"
      width={260}
      height={450}
      initialX={initialX}
      initialY={initialY}
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <BuddyContainer>
        <Header>
          <BrandLogo src="/burnware-logo.png" alt="BurnWare" />
          <HeaderText>
            <HeaderTitle>BurnWare</HeaderTitle>
            <HeaderSubtitle>{activeLinks.length + expiringLinks.length} active</HeaderSubtitle>
          </HeaderText>
        </Header>

        <ScrollArea>
          <GroupHeader
            onClick={() => toggleGroup('active')}
            aria-expanded={expandedGroups.has('active')}
            aria-controls="group-active"
          >
            <span>{expandedGroups.has('active') ? '▼' : '▶'}</span>
            <span>Active Links ({activeLinks.length})</span>
          </GroupHeader>
          {expandedGroups.has('active') &&
            activeLinks.map((link) => (
              <BuddyListItem
                key={link.link_id}
                name={link.display_name}
                status="active"
                messageCount={link.message_count}
                onClick={() => handleLinkClick(link.link_id)}
              />
            ))}

          {expiringLinks.length > 0 && (
            <>
              <GroupHeader
                onClick={() => toggleGroup('expiring')}
                aria-expanded={expandedGroups.has('expiring')}
                aria-controls="group-expiring"
              >
                <span>{expandedGroups.has('expiring') ? '▼' : '▶'}</span>
                <span>Expiring Soon ({expiringLinks.length})</span>
              </GroupHeader>
              {expandedGroups.has('expiring') &&
                expiringLinks.map((link) => (
                  <BuddyListItem
                    key={link.link_id}
                    name={link.display_name}
                    status="expiring"
                    messageCount={link.message_count}
                    onClick={() => handleLinkClick(link.link_id)}
                  />
                ))}
            </>
          )}

          <GroupHeader
            onClick={() => toggleGroup('expired')}
            aria-expanded={expandedGroups.has('expired')}
            aria-controls="group-expired"
          >
            <span>{expandedGroups.has('expired') ? '▼' : '▶'}</span>
            <span>Expired ({expiredLinks.length})</span>
          </GroupHeader>
          {expandedGroups.has('expired') &&
            expiredLinks.map((link) => (
              <BuddyListItem
                key={link.link_id}
                name={link.display_name}
                status="expired"
                messageCount={0}
                onClick={() => handleLinkClick(link.link_id)}
              />
            ))}
        </ScrollArea>

        <ActionButtons>
          <CreateButton onClick={onCreateLink}>✨ New Link</CreateButton>
          {onSettings && <Button onClick={onSettings}>Settings</Button>}
        </ActionButtons>
      </BuddyContainer>
    </WindowFrame>
  );
};
