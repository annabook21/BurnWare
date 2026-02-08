/**
 * Links Panel Component
 * Links management with AIM styling
 * File size: ~245 lines
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { BuddyList } from '../aim-ui/BuddyList';
import { AwayMessageDialog } from '../aim-ui/AwayMessageDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { QRCodeDialog } from './QRCodeDialog';
import axios from 'axios';
import { toast } from 'sonner';
import apiClient from '../../utils/api-client';
import { endpoints } from '../../config/api-endpoints';
import { getAccessToken } from '../../config/cognito-config';
import { useAIMSounds } from '../../hooks/useAIMSounds';
import type { Link } from '../../types';

const POLL_INTERVAL_MS = 15000; // 15 seconds (lighter than threads — just link metadata)

interface LinksPanelProps {
  onLinkSelect: (linkId: string, linkName: string) => void;
  zIndex?: number;
  onFocus?: () => void;
}

const Container = styled.div`
  position: relative;
`;

export const LinksPanel: React.FC<LinksPanelProps> = ({ onLinkSelect, zIndex, onFocus }) => {
  const { playFilesDone } = useAIMSounds();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [showDescDialog, setShowDescDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);

  const fetchLinks = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.get(endpoints.dashboard.links(), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      setLinks(response.data.data || []);
      setLoading(false);
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch links:', error);
        setLoading(false);
      }
    }
  }, []);

  // Recursive setTimeout polling: avoids overlapping requests
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      await fetchLinks(controller.signal);
      if (!stopped) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchLinks]);

  const handleLinkClick = (linkId: string) => {
    const link = links.find((l) => l.link_id === linkId);
    if (!link) return;

    // Always make QR/share available
    setSelectedLink(link);
    setShowQRDialog(true);

    // Also open threads panel if there are messages
    if (link.message_count > 0) {
      onLinkSelect(linkId, link.display_name);
    }
  };

  const handleCreateLink = () => {
    setShowCreateDialog(true);
  };

  const handleLinkCreated = async (data: { display_name: string; description?: string }) => {
    try {
      const token = await getAccessToken();
      const response = await apiClient.post(
        endpoints.dashboard.links(),
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchLinks();
      setShowCreateDialog(false);
      playFilesDone();

      // Show QR code for new link
      const newLink = response.data.data;
      setSelectedLink(newLink);
      setShowQRDialog(true);
    } catch (error) {
      console.error('Failed to create link:', error);
      toast.error('Failed to create link. Please try again.');
    }
  };

  const handleUpdateDescription = async (description: string) => {
    if (!selectedLink) return;

    try {
      const token = await getAccessToken();
      await apiClient.patch(
        endpoints.dashboard.link(selectedLink.link_id),
        { description },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchLinks();
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
        onLinkClick={handleLinkClick}
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
        />
      )}
    </Container>
  );
};
