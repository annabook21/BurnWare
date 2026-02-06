/**
 * Login Window Component
 * Cognito authentication with AIM aesthetic
 * File size: ~220 lines
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import { CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
import { userPool } from '../../config/cognito-config';

interface LoginWindowProps {
  onLoginSuccess: (token: string) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.xl};
  align-items: center;
  justify-content: center;
`;

const LogoSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: ${aimTheme.spacing.xl};
`;

const Logo = styled.img`
  width: 96px;
  height: 96px;
  object-fit: contain;
  margin-bottom: ${aimTheme.spacing.md};
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3));
`;

const Title = styled.div`
  font-size: ${aimTheme.fonts.size.large};
  font-weight: ${aimTheme.fonts.weight.bold};
  color: ${aimTheme.colors.brandOrange};
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
`;

const Subtitle = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: #666;
  margin-top: ${aimTheme.spacing.xs};
`;

const Form = styled.form`
  width: 100%;
  max-width: 300px;
`;

const Field = styled.div`
  margin-bottom: ${aimTheme.spacing.lg};
`;

const Label = styled.label`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.xs};
  display: block;
`;

const Input = styled.input`
  width: 100%;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};

  &:focus {
    outline: 1px solid ${aimTheme.colors.blue};
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;
`;

const Button = styled.button`
  width: 100%;
  padding: 6px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: ${aimTheme.fonts.weight.bold};
  cursor: pointer;
  margin-top: ${aimTheme.spacing.md};

  &:active {
    border-style: inset;
  }

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${aimTheme.colors.fireRed};
  font-size: ${aimTheme.fonts.size.small};
  margin-top: ${aimTheme.spacing.sm};
  padding: ${aimTheme.spacing.sm};
  background: #FFE0E0;
  border: 1px solid ${aimTheme.colors.fireRed};
`;

export const LoginWindow: React.FC<LoginWindowProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const token = session.getAccessToken().getJwtToken();
          if (rememberMe) {
            localStorage.setItem('authToken', token);
          } else {
            sessionStorage.setItem('authToken', token);
          }
          onLoginSuccess(token);
        },
        onFailure: (err) => {
          setError(err.message || 'Login failed. Please check your credentials.');
          setLoading(false);
        },
      });
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <WindowFrame title="🔥 Sign On to BurnWare" width={440} height={480}>
      <Container>
        <LogoSection>
          <Logo src="/burnware-logo.png" alt="BurnWare" />
          <Title>BurnWare</Title>
          <Subtitle>Anonymous Inbox System</Subtitle>
        </LogoSection>

        <Form onSubmit={handleSubmit}>
          <Field>
            <Label>Email:</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field>
            <Label>Password:</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <Field>
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember Me</span>
            </CheckboxLabel>
          </Field>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" disabled={loading || !email || !password}>
            {loading ? 'Signing On...' : 'Sign On'}
          </Button>
        </Form>
      </Container>
    </WindowFrame>
  );
};
