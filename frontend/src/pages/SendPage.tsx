/**
 * Send Page
 * Public anonymous message sending page
 * File size: ~110 lines
 */

import React from 'react';
import styled from 'styled-components';
import { useParams } from 'react-router-dom';
import { SendMessageWindow } from '../components/public/SendMessageWindow';
import { aimTheme } from '../theme/aim-theme';

const Desktop = styled.div`
  width: 100vw;
  height: 100vh;
  background: ${aimTheme.colors.desktopTeal};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const CenteredContainer = styled.div`
  position: relative;
`;

const Footer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: ${aimTheme.spacing.sm};
  background: rgba(192, 192, 192, 0.9);
  border-top: 2px solid ${aimTheme.colors.white};
  text-align: center;
  font-size: ${aimTheme.fonts.size.small};
  color: #666;
  z-index: 9999;
`;

export const SendPage: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();

  if (!linkId) {
    return (
      <Desktop>
        <div
          style={{
            background: aimTheme.colors.white,
            padding: aimTheme.spacing.xl,
            border: `2px outset ${aimTheme.colors.gray}`,
          }}
        >
          <h2>Invalid Link</h2>
          <p>The link you're looking for doesn't exist or has expired.</p>
        </div>
      </Desktop>
    );
  }

  return (
    <Desktop>
      <CenteredContainer>
        <SendMessageWindow linkId={linkId} />
      </CenteredContainer>

      <Footer>
        🔥 BurnWare - Anonymous Inbox System | Your message is completely anonymous
      </Footer>
    </Desktop>
  );
};
