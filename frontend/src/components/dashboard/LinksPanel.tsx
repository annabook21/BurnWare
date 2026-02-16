/**
 * Links Panel Component
 * Links and Broadcast channels — receives data from parent via props
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { BuddyList } from '../aim-ui/BuddyList';
import { BuddyContextMenu } from '../aim-ui/BuddyContextMenu';
import { AwayMessageDialog } from '../aim-ui/AwayMessageDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { QRCodeDialog } from './QRCodeDialog';
import { BroadcastCreateDialog } from './BroadcastCreateDialog';
import { BroadcastChannelContextMenu } from './BroadcastChannelContextMenu';
import { ConfirmDialog } from '../aim-ui/ConfirmDialog';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import { generateKeyPair } from '../../utils/e2ee';
import { saveLinkKey } from '../../utils/key-store';
import type { Link, BroadcastChannel } from '../../types';
import type { CreateBroadcastChannelResult } from '../../types';

interface LinksPanelProps {
  links: Link[];
  loading: boolean;
  newMessageLinkIds: Set<string>;
  onOpenThreads: (linkId: string, linkName: string) => void;
  onOpenChannel: (channelId: string, channelName: string, readUrl: string, postToken?: string, encryptionKey?: string) => void;
  onLinksChanged: () => Promise<void>;
  zIndex?: number;
  onFocus?: () => void;
}

const Container = styled.div`
  position: relative;
`;

export const LinksPanel: React.FC<LinksPanelProps> = ({
  links,
  loading,
  newMessageLinkIds,
  onOpenThreads,
  onOpenChannel,
  onLinksChanged,
  zIndex,
  onFocus,
}) => {
  const { playFilesDone } = useAIMSounds();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [showDescDialog, setShowDescDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ linkId: string; x: number; y: number } | null>(null);

  // Broadcast channels
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [showBroadcastCreateDialog, setShowBroadcastCreateDialog] = useState(false);
  const [channelPostTokens, setChannelPostTokens] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('bw:bc:postTokens') || '{}');
    } catch { return {}; }
  });
  const [channelEncryptionKeys, setChannelEncryptionKeys] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('bw:bc:encKeys') || '{}');
    } catch { return {}; }
  });
  const [selectedChannel, setSelectedChannel] = useState<BroadcastChannel | null>(null);
  const [showChannelQRDialog, setShowChannelQRDialog] = useState(false);
  const [channelContextMenu, setChannelContextMenu] = useState<{ channelId: string; x: number; y: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // AIM-style: double-click opens message window; single-click delayed so double-click can cancel it
  const pendingClickRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const SINGLE_CLICK_DELAY_MS = 250;

  const fetchChannels = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.broadcastChannels(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChannels(response.data.data?.channels || []);
    } catch (error) {
      console.error('Failed to fetch broadcast channels:', error);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleContextMenu = useCallback((linkId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ linkId, x: e.clientX, y: e.clientY });
  }, []);

  const getContextLink = () => links.find((l) => l.link_id === contextMenu?.linkId) || null;

  const doSingleClick = useCallback((linkId: string) => {
    const link = links.find((l) => l.link_id === linkId);
    if (!link) return;
    if (link.message_count > 0) {
      onOpenThreads(linkId, link.display_name);
    } else {
      setSelectedLink(link);
      setShowQRDialog(true);
    }
  }, [links, onOpenThreads]);

  const handleLinkClick = useCallback((linkId: string) => {
    if (pendingClickRef.current) clearTimeout(pendingClickRef.current);
    pendingClickRef.current = setTimeout(() => {
      pendingClickRef.current = null;
      doSingleClick(linkId);
    }, SINGLE_CLICK_DELAY_MS);
  }, [doSingleClick]);

  const handleLinkDoubleClick = useCallback((linkId: string) => {
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current);
      pendingClickRef.current = null;
    }
    const link = links.find((l) => l.link_id === linkId);
    if (!link) return;
    if (link.message_count > 0) {
      onOpenThreads(linkId, link.display_name);
    } else {
      window.open(`${window.location.origin}/l/${linkId}`, '_blank', 'noopener,noreferrer');
    }
  }, [links, onOpenThreads]);

  const handleCreateLink = () => {
    setShowCreateDialog(true);
  };

  const handleLinkCreated = async (data: {
    display_name: string;
    description?: string;
    expires_in_days?: number;
    opsec_mode?: boolean;
    opsec_access?: 'device_bound' | 'single_use';
    opsec_passphrase?: string;
  }) => {
    try {
      const { publicKeyBase64, privateKeyJwk } = await generateKeyPair();

      const token = await getAccessToken();
      const response = await apiClient.post(
        endpoints.dashboard.links(),
        { ...data, public_key: publicKeyBase64 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newLink = response.data.data;
      await saveLinkKey(newLink.link_id, privateKeyJwk);

      await onLinksChanged();
      setShowCreateDialog(false);
      playFilesDone();

      setSelectedLink(newLink);
      setShowQRDialog(true);
    } catch (error) {
      console.error('Failed to create link:', error);
      toast.error('Failed to create link. Please try again.');
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const token = await getAccessToken();
      await apiClient.delete(endpoints.dashboard.link(linkId), {
        headers: { Authorization: `Bearer ${token}` },
      });

      playFilesDone();
      toast.success('Link deleted.');
      setShowQRDialog(false);
      setSelectedLink(null);
      await onLinksChanged();
    } catch (error) {
      console.error('Failed to delete link:', error);
      toast.error('Failed to delete link.');
    }
  };

  const handleUpdateDescription = async (description: string) => {
    if (!selectedLink) return;

    try {
      const token = await getAccessToken();
      await apiClient.patch(
        endpoints.dashboard.link(selectedLink.link_id),
        { description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await onLinksChanged();
      setShowDescDialog(false);
    } catch (error) {
      console.error('Failed to update description:', error);
      toast.error('Failed to update description.');
    }
  };

  // Channel handlers
  const handleChannelClick = (channelId: string) => {
    const ch = channels.find((c) => c.channel_id === channelId);
    if (!ch || ch.burned) return;
    onOpenChannel(ch.channel_id, ch.display_name, ch.read_url, channelPostTokens[ch.channel_id], channelEncryptionKeys[ch.channel_id]);
  };

  const handleChannelContextMenu = (channelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setChannelContextMenu({ channelId, x: e.clientX, y: e.clientY });
  };

  const handleBroadcastCreated = (result: CreateBroadcastChannelResult) => {
    setChannelPostTokens((prev) => {
      const next = { ...prev, [result.channel_id]: result.post_token };
      localStorage.setItem('bw:bc:postTokens', JSON.stringify(next));
      return next;
    });
    if (result.encryption_key) {
      setChannelEncryptionKeys((prev) => {
        const next = { ...prev, [result.channel_id]: result.encryption_key! };
        localStorage.setItem('bw:bc:encKeys', JSON.stringify(next));
        return next;
      });
    }
    fetchChannels();
    setShowBroadcastCreateDialog(false);
    playFilesDone();
  };

  const handleBurnChannel = (channelId: string, postToken: string) => {
    setConfirmAction({
      message: 'Burn this channel? The feed will stop and the link will no longer work.',
      onConfirm: () => { setConfirmAction(null); doBurnChannel(channelId, postToken); },
    });
  };

  const doBurnChannel = async (channelId: string, postToken: string) => {
    try {
      await apiClient.post(
        endpoints.public.broadcastBurn(channelId),
        { post_token: postToken }
      );
      toast.success('Channel burned');
      setChannelPostTokens((prev) => {
        const next = { ...prev };
        delete next[channelId];
        localStorage.setItem('bw:bc:postTokens', JSON.stringify(next));
        return next;
      });
      setChannelEncryptionKeys((prev) => {
        const next = { ...prev };
        delete next[channelId];
        localStorage.setItem('bw:bc:encKeys', JSON.stringify(next));
        return next;
      });
      fetchChannels();
    } catch (error) {
      console.error('Failed to burn channel:', error);
      toast.error('Failed to burn channel');
    }
  };

  const handleDeleteChannel = (channelId: string) => {
    setConfirmAction({
      message: 'Permanently delete this channel and all its posts?',
      onConfirm: () => { setConfirmAction(null); doDeleteChannel(channelId); },
    });
  };

  const doDeleteChannel = async (channelId: string) => {
    try {
      const token = await getAccessToken();
      await apiClient.delete(endpoints.dashboard.broadcastChannel(channelId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Channel deleted');
      setChannelPostTokens((prev) => {
        const next = { ...prev };
        delete next[channelId];
        localStorage.setItem('bw:bc:postTokens', JSON.stringify(next));
        return next;
      });
      setChannelEncryptionKeys((prev) => {
        const next = { ...prev };
        delete next[channelId];
        localStorage.setItem('bw:bc:encKeys', JSON.stringify(next));
        return next;
      });
      fetchChannels();
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast.error('Failed to delete channel');
    }
  };

  const getContextChannel = () => channels.find((c) => c.channel_id === channelContextMenu?.channelId) || null;

  if (loading) {
    return (
      <Container>
        <BuddyList
          links={[]}
          channels={[]}
          onLinkClick={() => {}}
          onLinkDoubleClick={() => {}}
          onCreateLink={() => {}}
          onCreateChannel={() => {}}
          zIndex={zIndex}
          onFocus={onFocus}
        />
      </Container>
    );
  }

  return (
    <Container>
      <BuddyList
        links={links}
        channels={channels}
        newMessageLinkIds={newMessageLinkIds}
        onLinkClick={handleLinkClick}
        onLinkDoubleClick={handleLinkDoubleClick}
        onLinkContextMenu={handleContextMenu}
        onChannelClick={handleChannelClick}
        onChannelContextMenu={handleChannelContextMenu}
        onCreateLink={handleCreateLink}
        onCreateChannel={() => setShowBroadcastCreateDialog(true)}
        zIndex={zIndex}
        onFocus={onFocus}
      />

      {showCreateDialog && (
        <CreateLinkDialog
          onSave={handleLinkCreated}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {showDescDialog && selectedLink && (
        <AwayMessageDialog
          linkName={selectedLink.display_name}
          currentDescription={selectedLink.description}
          onSave={handleUpdateDescription}
          onClose={() => setShowDescDialog(false)}
        />
      )}

      {showQRDialog && selectedLink && (
        <QRCodeDialog
          linkId={selectedLink.link_id}
          linkName={selectedLink.display_name}
          qrCodeUrl={selectedLink.qr_code_url}
          onClose={() => {
            setShowQRDialog(false);
            setSelectedLink(null);
          }}
          onDelete={handleDeleteLink}
        />
      )}

      {showBroadcastCreateDialog && (
        <BroadcastCreateDialog
          onSave={handleBroadcastCreated}
          onClose={() => setShowBroadcastCreateDialog(false)}
        />
      )}

      {showChannelQRDialog && selectedChannel && (
        <QRCodeDialog
          linkId={selectedChannel.channel_id}
          linkName={selectedChannel.display_name}
          displayUrl={selectedChannel.read_url}
          onClose={() => {
            setShowChannelQRDialog(false);
            setSelectedChannel(null);
          }}
        />
      )}

      {contextMenu && (() => {
        const ctxLink = getContextLink();
        if (!ctxLink) return null;
        return (
          <BuddyContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasMessages={ctxLink.message_count > 0}
            onOpenThreads={() => onOpenThreads(ctxLink.link_id, ctxLink.display_name)}
            onOpenSendPage={() => window.open(`${window.location.origin}/l/${ctxLink.link_id}`, '_blank', 'noopener,noreferrer')}
            onGetBuddyInfo={() => {
              setSelectedLink(ctxLink);
              setShowQRDialog(true);
            }}
            onEditDescription={() => {
              setSelectedLink(ctxLink);
              setShowDescDialog(true);
            }}
            onDelete={() => handleDeleteLink(ctxLink.link_id)}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}

      {channelContextMenu && (() => {
        const ctxCh = getContextChannel();
        if (!ctxCh) return null;
        const postToken = channelPostTokens[ctxCh.channel_id];
        return (
          <BroadcastChannelContextMenu
            x={channelContextMenu.x}
            y={channelContextMenu.y}
            channel={ctxCh}
            postToken={postToken}
            onOpen={() => onOpenChannel(ctxCh.channel_id, ctxCh.display_name, ctxCh.read_url, postToken, channelEncryptionKeys[ctxCh.channel_id])}
            onCopyLink={() => {
              navigator.clipboard.writeText(ctxCh.read_url);
              toast.success('Read link copied');
            }}
            onShowQR={() => {
              setSelectedChannel(ctxCh);
              setShowChannelQRDialog(true);
            }}
            onBurn={() => postToken && handleBurnChannel(ctxCh.channel_id, postToken)}
            onDelete={() => handleDeleteChannel(ctxCh.channel_id)}
            onClose={() => setChannelContextMenu(null)}
          />
        );
      })()}

      {confirmAction && (
        <ConfirmDialog
          title="Confirm"
          message={confirmAction.message}
          icon="⚠️"
          confirmText="Yes"
          cancelText="No"
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </Container>
  );
};
