/**
 * Loading Screen Component
 * AIM-styled loading indicator
 * File size: ~85 lines
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

const flame = keyframes`
  0%, 100% { transform: scaleY(1) rotate(0deg); }
  50% { transform: scaleY(1.1) rotate(2deg); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${aimTheme.spacing.lg};
  padding: ${aimTheme.spacing.xl};
`;

const Logo = styled.img`
  width: 64px;
  height: 64px;
  animation: ${flame} 1.5s ease-in-out infinite;
`;

const LoadingText = styled.div`
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  color: ${aimTheme.colors.darkGray};
`;

const LoadingBar = styled.div`
  width: 200px;
  height: 20px;
  border: ${aimTheme.borders.inset};
  background: ${aimTheme.colors.white};
  position: relative;
  overflow: hidden;
`;

const LoadingProgress = styled.div`
  height: 100%;
  background: ${aimTheme.colors.blue};
  animation: progress 2s ease-in-out infinite;

  @keyframes progress {
    0% { width: 0%; }
    50% { width: 70%; }
    100% { width: 0%; }
  }
`;

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading BurnWare...',
}) => {
  return (
    <Container>
      <Logo src="/burnware-logo.png" alt="BurnWare" />
      <LoadingText>{message}</LoadingText>
      <LoadingBar>
        <LoadingProgress />
      </LoadingBar>
    </Container>
  );
};
