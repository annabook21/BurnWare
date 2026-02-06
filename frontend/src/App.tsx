/**
 * Main App Component
 * Routing and authentication state
 * File size: ~180 lines
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { GlobalStyles } from './theme/global-styles';
import { aimTheme } from './theme/aim-theme';
import { Dashboard } from './pages/Dashboard';
import { SendPage } from './pages/SendPage';
import { LoginWindow } from './components/auth/LoginWindow';
import styled from 'styled-components';
import { getCurrentUser } from './config/cognito-config';

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

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = () => {
      const user = getCurrentUser();
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

      if (user && token) {
        user.getSession((err: Error | null, session: { isValid: () => boolean } | null) => {
          if (!err && session?.isValid()) {
            setIsAuthenticated(true);
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (_token: string) => {
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
      <BrowserRouter>
        <AppContainer>
          <Routes>
            {/* Public route - anonymous message sending */}
            <Route path="/l/:linkId" element={<SendPage />} />

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
        </AppContainer>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
