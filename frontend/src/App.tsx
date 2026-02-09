/**
 * Main App Component
 * Routing and authentication state
 * File size: ~180 lines
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { ThemeProvider } from 'styled-components';
import { GlobalStyles } from './theme/global-styles';
import { aimTheme } from './theme/aim-theme';
import { Dashboard } from './pages/Dashboard';
import { SendPage } from './pages/SendPage';
import { ThreadPage } from './pages/ThreadPage';
import { LoginWindow } from './components/auth/LoginWindow';
import styled from 'styled-components';
import { Toaster } from 'sonner';
import { getAccessToken } from './config/cognito-config';
import { useAIMSounds } from './hooks/useAIMSounds';
import { requestPersistentStorage } from './utils/key-store';

const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const LoginDesktop = styled.div`
  width: 100vw;
  height: 100vh;
  background: ${aimTheme.colors.desktopTeal};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ErrorFallback: React.FC<FallbackProps> = ({ resetErrorBoundary }) => (
  <LoginDesktop>
    <div
      style={{
        background: aimTheme.colors.gray,
        border: `2px outset ${aimTheme.colors.gray}`,
        padding: 0,
        width: 320,
        fontFamily: aimTheme.fonts.primary,
      }}
    >
      <div
        style={{
          background: aimTheme.colors.blueGradientStart,
          color: aimTheme.colors.white,
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: aimTheme.fonts.size.normal,
        }}
      >
        BurnWare - Error
      </div>
      <div style={{ padding: '16px' }}>
        <p style={{ margin: '0 0 12px', fontSize: aimTheme.fonts.size.normal }}>
          Something went wrong. Please reload the application.
        </p>
        <button
          onClick={resetErrorBoundary}
          style={{
            padding: '4px 16px',
            border: `2px outset ${aimTheme.colors.gray}`,
            background: aimTheme.colors.gray,
            fontFamily: aimTheme.fonts.primary,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    </div>
  </LoginDesktop>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { playWelcome } = useAIMSounds();

  useEffect(() => {
    requestPersistentStorage().catch(() => {});

    const checkAuth = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          setIsAuthenticated(true);
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    playWelcome();
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <AppContainer>
        <LoginDesktop>
          <div style={{ color: aimTheme.colors.white, fontSize: aimTheme.fonts.size.large }}>
            Loading...
          </div>
        </LoginDesktop>
      </AppContainer>
    );
  }

  return (
    <ThemeProvider theme={aimTheme}>
      <GlobalStyles />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: aimTheme.fonts.primary,
            fontSize: aimTheme.fonts.size.normal,
          },
        }}
      />
      <BrowserRouter>
        <AppContainer>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
          <Routes>
            {/* Public route - anonymous message sending */}
            <Route path="/l/:linkId" element={<SendPage />} />

            {/* Public route - anonymous sender checks replies (possession-based: URL = secret) */}
            <Route path="/thread/:threadId" element={<ThreadPage />} />

            {/* Protected dashboard route */}
            <Route
              path="/dashboard"
              element={
                isAuthenticated ? (
                  <Dashboard />
                ) : (
                  <LoginDesktop>
                    <LoginWindow onLoginSuccess={handleLoginSuccess} />
                  </LoginDesktop>
                )
              }
            />

            {/* Root redirect */}
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginDesktop>
                    <LoginWindow onLoginSuccess={handleLoginSuccess} />
                  </LoginDesktop>
                )
              }
            />

            {/* 404 */}
            <Route
              path="*"
              element={
                <LoginDesktop>
                  <div style={{ background: aimTheme.colors.white, padding: 20 }}>
                    <h2>Page Not Found</h2>
                    <p>The page you're looking for doesn't exist.</p>
                  </div>
                </LoginDesktop>
              }
            />
          </Routes>
          </ErrorBoundary>
        </AppContainer>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
