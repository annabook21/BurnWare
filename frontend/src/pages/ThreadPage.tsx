/**
 * Thread Page
 * Anonymous sender view — check for replies (possession-based: URL = secret)
 * Uses shared ThreadView component for polling + rendering.
 */

import React from 'react';
import styled from 'styled-components';
import { useParams } from 'react-router-dom';
import { aimTheme } from '../theme/aim-theme';
import { ThreadView } from '../components/public/ThreadView';

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

const ThreadBox = styled.div`
  background: ${aimTheme.colors.gray};
  border: 2px outset ${aimTheme.colors.gray};
  width: 480px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: ${aimTheme.shadows.window};
`;

const TitleBar = styled.div`
  background: linear-gradient(to bottom, ${aimTheme.colors.blueGradientStart}, ${aimTheme.colors.blueGradientEnd});
  color: ${aimTheme.colors.white};
  padding: 4px 8px;
  font-weight: bold;
  font-size: ${aimTheme.fonts.size.normal};
`;

export const ThreadPage: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();

  if (!threadId) {
    return (
      <Desktop>
        <ThreadBox>
          <TitleBar>Invalid Thread</TitleBar>
          <div style={{ padding: aimTheme.spacing.md }}>
            <p>The thread URL is invalid.</p>
          </div>
        </ThreadBox>
      </Desktop>
    );
  }

  return (
    <Desktop>
      <ThreadBox>
        <TitleBar>Your anonymous thread — replies appear here</TitleBar>
        <ThreadView threadId={threadId} />
      </ThreadBox>
    </Desktop>
  );
};
