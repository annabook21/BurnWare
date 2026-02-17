/**
 * QR Code Dialog Component
 * Displays QR code in AIM-styled window
 * File size: ~140 lines
 */

import React, { useEffect } from 'react';
import styled from 'styled-components';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { Button98, BurnButton } from '../aim-ui/Button98';
import { aimTheme } from '../../theme/aim-theme';
import { awsConfig } from '../../config/aws-config';

interface QRCodeDialogProps {
  linkId: string;
  linkName: string;
  qrCodeUrl?: string;
  /** If set, use this URL for QR and copy instead of building from linkId (e.g. broadcast read URL) */
  displayUrl?: string;
  onClose: () => void;
  onDelete?: (linkId: string) => void;
}

const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;
  min-width: 0;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
  align-items: center;
  overflow-x: hidden;
`;

const QRContainer = styled.div`
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.lg};
  box-shadow: var(--border-field);
  border: none;
  margin: ${aimTheme.spacing.md} 0;
`;

const LinkInfo = styled.div`
  text-align: center;
  margin-bottom: ${aimTheme.spacing.md};
  max-width: 100%;
  min-width: 0;
`;

const LinkName = styled.div`
  font-weight: ${aimTheme.fonts.weight.bold};
  font-size: ${aimTheme.fonts.size.medium};
  margin-bottom: ${aimTheme.spacing.sm};
`;

const LinkUrl = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.blue};
  word-break: break-all;
  padding: ${aimTheme.spacing.sm};
  background: ${aimTheme.colors.white};
  box-shadow: var(--border-field);
  border: none;
  margin: ${aimTheme.spacing.sm} 0;
  max-width: 100%;
  min-width: 0;
`;

const ButtonBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${aimTheme.spacing.sm};
  margin-top: auto;
  justify-content: center;
`;

export const QRCodeDialog: React.FC<QRCodeDialogProps> = ({
  linkId,
  linkName,
  qrCodeUrl: _qrCodeUrl,
  displayUrl,
  onClose,
  onDelete,
}) => {
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const baseUrl =
    awsConfig.api.baseUrl.replace('/api', '') || window.location.origin;
  const fullUrl = displayUrl ?? `${baseUrl}/l/${linkId}`;

  // Auto-copy on open so owner can paste and share in one less click
  useEffect(() => {
    if (fullUrl) {
      navigator.clipboard.writeText(fullUrl).catch(() => {});
      toast.success('Link copied to clipboard');
    }
  }, [fullUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copied to clipboard!');
  };

  const handleOpenSendPage = () => {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector('#qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');

      const downloadLink = document.createElement('a');
      downloadLink.download = `burnware-${linkId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <WindowFrame
      title={`QR Code - ${linkName}`}
      width={420}
      height={580}
      initialX={180}
      initialY={80}
      zIndex={1002}
      onClose={onClose}
    >
      <DialogContainer>
        <LinkInfo>
          <LinkName>🔥 {linkName}</LinkName>
          <div style={{ fontSize: aimTheme.fonts.size.small, color: aimTheme.colors.darkGray, marginBottom: aimTheme.spacing.sm }}>
            Share this link so others can send you messages. Double-click any link in the list to open the send page.
          </div>
          <LinkUrl>{fullUrl}</LinkUrl>
        </LinkInfo>

        <QRContainer>
          <QRCodeSVG id="qr-code-svg" value={fullUrl} size={256} level="H" />
        </QRContainer>

        <ButtonBar>
          <Button98 onClick={handleOpenSendPage}>✉️ Open send page</Button98>
          <Button98 onClick={handleCopyLink}>📋 Copy Link</Button98>
          <Button98 onClick={handleDownloadQR}>💾 Download QR</Button98>
          {onDelete && !confirmingDelete && (
            <BurnButton onClick={() => setConfirmingDelete(true)}>🗑️ Delete</BurnButton>
          )}
          {onDelete && confirmingDelete && (
            <>
              <BurnButton onClick={() => onDelete(linkId)}>Confirm</BurnButton>
              <Button98 onClick={() => setConfirmingDelete(false)}>Cancel</Button98>
            </>
          )}
          {!confirmingDelete && <Button98 onClick={onClose}>Close</Button98>}
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
