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
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
  align-items: center;
`;

const QRContainer = styled.div`
  background: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.lg};
  border: ${aimTheme.borders.inset};
  margin: ${aimTheme.spacing.md} 0;
`;

const LinkInfo = styled.div`
  text-align: center;
  margin-bottom: ${aimTheme.spacing.md};
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
  border: ${aimTheme.borders.inset};
  margin: ${aimTheme.spacing.sm} 0;
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  margin-top: auto;
`;

const Button = styled.button`
  padding: 4px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;
  min-width: 75px;

  &:active {
    border-style: inset;
  }
`;

const DeleteButton = styled(Button)`
  background: #FF6B6B;
  color: white;
  font-weight: bold;

  &:hover {
    background: #FF4444;
  }
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
      width={380}
      height={480}
      initialX={200}
      initialY={100}
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
          <Button onClick={handleOpenSendPage}>✉️ Open send page</Button>
          <Button onClick={handleCopyLink}>📋 Copy Link</Button>
          <Button onClick={handleDownloadQR}>💾 Download QR</Button>
          {onDelete && !confirmingDelete && (
            <DeleteButton onClick={() => setConfirmingDelete(true)}>🗑️ Delete</DeleteButton>
          )}
          {onDelete && confirmingDelete && (
            <>
              <DeleteButton onClick={() => onDelete(linkId)}>Confirm</DeleteButton>
              <Button onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            </>
          )}
          {!confirmingDelete && <Button onClick={onClose}>Close</Button>}
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
