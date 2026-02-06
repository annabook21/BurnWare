/**
 * Links Panel Component
 * Links management with AIM styling
 * File size: ~245 lines
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BuddyList } from '../aim-ui/BuddyList';
import { AwayMessageDialog } from '../aim-ui/AwayMessageDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { QRCodeDialog } from './QRCodeDialog';
import axios from 'axios';
import { awsConfig } from '../../config/aws-config';
import { getAccessToken } from '../../config/cognito-config';
import type { Link } from '../../types';

interface LinksPanelProps {
  onLinkSelect: (linkId: string) => void;
  zIndex?: number;
  onFocus?: () => void;
}

const Container = styled.div`
  position: relative;
`;

export const LinksPanel: React.FC<LinksPanelProps> = ({ onLinkSelect, zIndex, onFocus }) => {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [showDescDialog, setShowDescDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${awsConfig.api.baseUrl}/api/v1/dashboard/links`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setLinks(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch links:', error);
      setLoading(false);
    }
  };

  const handleLinkClick = (linkId: string) => {
    const link = links.find((l) => l.link_id === linkId);
    if (link && link.message_count > 0) {
      onLinkSelect(linkId);
    } else {
      // Show link details/QR code if no messages
      setSelectedLink(link || null);
      setShowQRDialog(true);
    }
  };

  const handleCreateLink = () => {
    setShowCreateDialog(true);
  };

  const handleLinkCreated = async (data: { display_name: string; description?: string }) => {
    try {
      const token = await getAccessToken();
      const response = await axios.post(
        `${awsConfig.api.baseUrl}/api/v1/dashboard/links`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchLinks();
      setShowCreateDialog(false);

      // Show QR code for new link
      const newLink = response.data.data;
      setSelectedLink(newLink);
      setShowQRDialog(true);
    } catch (error) {
      console.error('Failed to create link:', error);
      alert('Failed to create link. Please try again.');
    }
  };

  const handleUpdateDescription = async (description: string) => {
    if (!selectedLink) return;

    try {
      const token = await getAccessToken();
      await axios.patch(
        `${awsConfig.api.baseUrl}/api/v1/dashboard/links/${selectedLink.link_id}`,
        { description },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchLinks();
      setShowDescDialog(false);
    } catch (error) {
      console.error('Failed to update description:', error);
      alert('Failed to update description.');
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
