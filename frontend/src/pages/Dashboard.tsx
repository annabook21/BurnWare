/**
 * Dashboard Page
 * Main dashboard with AIM multi-window interface
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { LinksPanel } from '../components/dashboard/LinksPanel';
import { ThreadsPanel } from '../components/dashboard/ThreadsPanel';
import { BackupSetupDialog } from '../components/dashboard/BackupSetupDialog';
import { WindowManager } from '../components/aim-ui/WindowManager';
import { SoundManager } from '../components/aim-ui/SoundManager';
import { useAIMSounds } from '../hooks/useAIMSounds';
import { useMessagePolling } from '../hooks/useMessagePolling';
import { aimTheme } from '../theme/aim-theme';
import { signOut, getAccessToken } from '../config/cognito-config';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { getAllLinkKeys } from '../utils/key-store';

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

interface OpenLink {
  linkId: string;
  linkName: string;
}

export const Dashboard: React.FC = () => {
  const [soundsMuted, setSoundsMuted] = useState(false);
  const [openLinks, setOpenLinks] = useState<Map<string, OpenLink>>(new Map());
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [showBackupSetup, setShowBackupSetup] = useState(false);
  const [unbackedLinkIds, setUnbackedLinkIds] = useState<string[]>([]);
  const [time, setTime] = useState(new Date());
  const { setMuted, playBuddyOut, playYouvGotMail } = useAIMSounds();
  const { links, loading, newMessageLinkIds, acknowledgeLink, refreshLinks } = useMessagePolling();
  const prevNewIdsRef = useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if backup setup is needed (once after links load; re-run only when link set changes)
  const checkedLinkIdsRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || links.length === 0) return;
    if (localStorage.getItem('bw:backup-configured')) return;

    const linkIdsKey = links.map((l) => l.link_id).sort().join(',');
    if (checkedLinkIdsRef.current === linkIdsKey) return;
    checkedLinkIdsRef.current = linkIdsKey;

    const checkBackup = async () => {
      try {
        const localKeys = await getAllLinkKeys();
        if (localKeys.size === 0) return;

        const token = await getAccessToken();
        const toCheck = links.filter((l) => localKeys.has(l.link_id));
        const results = await Promise.allSettled(
          toCheck.map((link) =>
            apiClient.get(endpoints.dashboard.keyBackup(link.link_id), {
              headers: { Authorization: `Bearer ${token}` },
            })
          )
        );
        const needsBackup: string[] = [];
        toCheck.forEach((link, i) => {
          if (results[i].status === 'rejected') needsBackup.push(link.link_id);
        });
        if (needsBackup.length > 0) {
          setUnbackedLinkIds(needsBackup);
          setShowBackupSetup(true);
        }
      } catch {
        // Non-critical — don't block dashboard
      }
    };

    checkBackup();
  }, [links, loading]);

  React.useEffect(() => {
    setMuted(soundsMuted);
  }, [soundsMuted, setMuted]);

  // Auto-popup: when new messages detected, open ThreadsPanel + play sound
  useEffect(() => {
    if (newMessageLinkIds.size === 0) return;

    // Find truly new IDs (not already seen in previous render)
    const freshIds: string[] = [];
    for (const id of newMessageLinkIds) {
      if (!prevNewIdsRef.current.has(id)) {
        freshIds.push(id);
      }
    }
    prevNewIdsRef.current = new Set(newMessageLinkIds);

    if (freshIds.length === 0) return;

    // Auto-open ThreadsPanel for each new-message link
    setOpenLinks((prev) => {
      const next = new Map(prev);
      for (const linkId of freshIds) {
        if (!next.has(linkId)) {
          const link = links.find((l) => l.link_id === linkId);
          next.set(linkId, { linkId, linkName: link?.display_name || 'Unknown' });
        }
      }
      return next;
    });

    playYouvGotMail();
  }, [newMessageLinkIds, links, playYouvGotMail]);

  const handleOpenThreads = useCallback((linkId: string, linkName: string) => {
    setOpenLinks((prev) => {
      const next = new Map(prev);
      next.set(linkId, { linkId, linkName });
      return next;
    });
  }, []);

  const handleCloseThreads = useCallback((linkId: string) => {
    setOpenLinks((prev) => {
      const next = new Map(prev);
      next.delete(linkId);
      return next;
    });
    acknowledgeLink(linkId);
  }, [acknowledgeLink]);

  const handleLogout = () => {
    if (window.confirm('Sign out of BurnWare?')) {
      playBuddyOut();
      signOut();
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const openLinksArray = Array.from(openLinks.values());

  return (
    <WindowManager>
      {(_windowManager) => (
        <Desktop>
          <LinksPanel
            links={links}
            loading={loading}
            newMessageLinkIds={newMessageLinkIds}
            onOpenThreads={handleOpenThreads}
            onLinksChanged={refreshLinks}
            zIndex={100}
          />

          {showBackupSetup && (
            <BackupSetupDialog
              linkIds={unbackedLinkIds}
              onComplete={() => setShowBackupSetup(false)}
              onClose={() => {
                setShowBackupSetup(false);
                localStorage.setItem('bw:backup-configured', 'skipped');
              }}
            />
          )}

          {openLinksArray.map((ol, index) => (
            <ThreadsPanel
              key={ol.linkId}
              linkId={ol.linkId}
              linkName={ol.linkName}
              onClose={() => handleCloseThreads(ol.linkId)}
              initialX={320 + index * 30}
              initialY={50 + index * 30}
              zIndex={101 + index}
            />
          ))}

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
                Sign Out
              </button>
            </div>
          )}
        </Desktop>
      )}
    </WindowManager>
  );
};
