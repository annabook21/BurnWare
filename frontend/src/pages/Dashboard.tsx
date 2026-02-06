/**
 * Dashboard Page
 * Main dashboard with AIM multi-window interface
 * File size: ~210 lines
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { LinksPanel } from '../components/dashboard/LinksPanel';
import { ThreadsPanel } from '../components/dashboard/ThreadsPanel';
import { WindowManager } from '../components/aim-ui/WindowManager';
import { SoundManager } from '../components/aim-ui/SoundManager';
import { useAIMSounds } from '../hooks/useAIMSounds';
import { aimTheme } from '../theme/aim-theme';
import { signOut } from '../config/cognito-config';

const Desktop = styled.div`
  width: 100vw;
  height: 100vh;
  background: ${aimTheme.colors.desktopTeal};
  position: relative;
  overflow: hidden;
`;

const Taskbar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: ${aimTheme.colors.gray};
  border-top: 2px solid ${aimTheme.colors.white};
  display: flex;
  align-items: center;
  padding: 0 ${aimTheme.spacing.sm};
  gap: ${aimTheme.spacing.sm};
  z-index: 9999;
`;

const StartButton = styled.button`
  padding: 2px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: ${aimTheme.fonts.weight.bold};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;

  &:active {
    border-style: inset;
  }
`;

const TaskbarSeparator = styled.div`
  width: 2px;
  height: 24px;
  background: ${aimTheme.colors.darkGray};
  border-left: 1px solid ${aimTheme.colors.white};
`;

const TaskbarButton = styled.button`
  padding: 2px 8px;
  border: ${aimTheme.borders.inset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.small};
  cursor: pointer;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:active {
    border-style: outset;
  }
`;

const Clock = styled.div`
  margin-left: auto;
  padding: 2px 8px;
  border: ${aimTheme.borders.inset};
  font-size: ${aimTheme.fonts.size.small};
`;

export const Dashboard: React.FC = () => {
  const [soundsMuted, setSoundsMuted] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{ linkId: string; linkName: string } | null>(
    null
  );
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [time, setTime] = useState(new Date());
  const { setMuted } = useAIMSounds();

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    setMuted(soundsMuted);
  }, [soundsMuted, setMuted]);

  const handleLinkSelect = (linkId: string, linkName: string) => {
    setSelectedLink({ linkId, linkName });
  };

  const handleLogout = () => {
    if (window.confirm('Sign out of BurnWare?')) {
      signOut();
      window.location.reload();
    }
  };

  return (
    <WindowManager>
      {(_windowManager) => (
        <Desktop>
          <LinksPanel
            onLinkSelect={(linkId) => {
              const links: { link_id: string; display_name: string }[] = []; // Would come from state
              const link = links.find((l) => l.link_id === linkId);
              if (link) {
                handleLinkSelect(linkId, (link as { display_name: string }).display_name);
              }
            }}
            zIndex={100}
          />

          {selectedLink && (
            <ThreadsPanel
              linkId={selectedLink.linkId}
              linkName={selectedLink.linkName}
              onClose={() => setSelectedLink(null)}
              initialX={320}
              initialY={50}
              zIndex={101}
            />
          )}

          <Taskbar>
            <StartButton onClick={() => setShowStartMenu(!showStartMenu)}>
              <img src="/burnware-logo.png" alt="" style={{ width: 20, height: 20 }} />
              <span>BurnWare</span>
            </StartButton>
            <TaskbarSeparator />
            <TaskbarButton>My Anonymous Links</TaskbarButton>
            <SoundManager muted={soundsMuted} onToggleMute={() => setSoundsMuted(!soundsMuted)} />
            <Clock>{time.toLocaleTimeString()}</Clock>
          </Taskbar>

          {showStartMenu && (
            <div
              style={{
                position: 'fixed',
                bottom: 32,
                left: 0,
                width: 200,
                background: aimTheme.colors.gray,
                border: `2px outset ${aimTheme.colors.gray}`,
                zIndex: 10000,
              }}
            >
              <button
                style={{
                  width: '100%',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onClick={handleLogout}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </Desktop>
      )}
    </WindowManager>
  );
};
