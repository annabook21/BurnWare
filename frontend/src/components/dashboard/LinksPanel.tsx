/**
 * Links Panel Component
 * Links management with AIM styling — receives data from parent via props
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { BuddyList } from '../aim-ui/BuddyList';
import { BuddyContextMenu } from '../aim-ui/BuddyContextMenu';
import { AwayMessageDialog } from '../aim-ui/AwayMessageDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { QRCodeDialog } from './QRCodeDialog';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import { generateKeyPair } from '../../utils/e2ee';
import { saveLinkKey } from '../../utils/key-store';
import type { Link } from '../../types';

interface LinksPanelProps {
  links: Link[];
  loading: boolean;
  newMessageLinkIds: Set<string>;
  onOpenThreads: (linkId: string, linkName: string) => void;
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

  const handleContextMenu = useCallback((linkId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ linkId, x: e.clientX, y: e.clientY });
  }, []);

  const getContextLink = () => links.find((l) => l.link_id === contextMenu?.linkId) || null;

  const handleLinkClick = (linkId: string) => {
    const link = links.find((l) => l.link_id === linkId);
    if (!link) return;

    if (link.message_count > 0) {
      // Has messages → open threads directly (classic AIM: click buddy → open IM)
      onOpenThreads(linkId, link.display_name);
    } else {
      // No messages → show QR/share dialog (primary action for empty links)
      setSelectedLink(link);
      setShowQRDialog(true);
    }
  };

  const handleCreateLink = () => {
    setShowCreateDialog(true);
  };

  const handleLinkCreated = async (data: { display_name: string; description?: string }) => {
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

      // Show QR code for new link
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

  if (loading) {
    return (
      <Container>
        <BuddyList
          links={[]}
          onLinkClick={() => {}}
          onCreateLink={() => {}}
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
        newMessageLinkIds={newMessageLinkIds}
        onLinkClick={handleLinkClick}
        onLinkContextMenu={handleContextMenu}
        onCreateLink={handleCreateLink}
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

      {contextMenu && (() => {
        const ctxLink = getContextLink();
        if (!ctxLink) return null;
        return (
          <BuddyContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasMessages={ctxLink.message_count > 0}
            onOpenThreads={() => onOpenThreads(ctxLink.link_id, ctxLink.display_name)}
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
    </Container>
  );
};
