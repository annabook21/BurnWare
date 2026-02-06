/**
 * Login Window Component
 * Cognito authentication with AIM aesthetic
 * Supports sign-in, sign-up, confirmation, and forgot password flows
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { aimTheme } from '../../theme/aim-theme';
import {
  signIn,
  signUp,
  confirmSignUp,
  resendConfirmationCode,
  forgotPassword,
  confirmForgotPassword,
} from '../../config/cognito-config';

type AuthMode = 'signIn' | 'signUp' | 'confirm' | 'forgotPassword' | 'resetPassword';

interface LoginWindowProps {
  onLoginSuccess: () => void;
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

const SuccessMessage = styled.div`
  color: #006600;
  font-size: ${aimTheme.fonts.size.small};
  margin-top: ${aimTheme.spacing.sm};
  padding: ${aimTheme.spacing.sm};
  background: #E0FFE0;
  border: 1px solid #006600;
`;

const LinkButton = styled.button`
  background: none;
  border: none;
  color: ${aimTheme.colors.blue};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.small};
  cursor: pointer;
  text-decoration: underline;
  padding: 0;

  &:hover {
    color: ${aimTheme.colors.darkBlue};
  }
`;

const LinksRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${aimTheme.spacing.lg};
`;

const Hint = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: ${aimTheme.colors.darkGray};
  margin-top: ${aimTheme.spacing.xs};
`;

const WINDOW_TITLES: Record<AuthMode, string> = {
  signIn: 'Sign On to BurnWare',
  signUp: 'Get a Screen Name',
  confirm: 'Verify Your Email',
  forgotPassword: 'Forgot Password',
  resetPassword: 'Reset Password',
};

const WINDOW_HEIGHTS: Record<AuthMode, number> = {
  signIn: 520,
  signUp: 620,
  confirm: 440,
  forgotPassword: 420,
  resetPassword: 540,
};

export const LoginWindow: React.FC<LoginWindowProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [screenName, setScreenName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetForm = (nextMode: AuthMode, keepEmail = false) => {
    if (!keepEmail) setEmail('');
    setScreenName('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setError('');
    setSuccess('');
    setMode(nextMode);
  };

  const doSignIn = async (signInEmail: string, signInPassword: string) => {
    try {
      const result = await signIn(signInEmail, signInPassword);

      if (result.isSignedIn) {
        onLoginSuccess();
        return;
      }

      // Handle challenges that require additional steps
      const step = result.nextStep?.signInStep;
      if (step === 'CONFIRM_SIGN_UP') {
        setError('');
        setSuccess('Your account is not confirmed. Please enter the verification code sent to your email.');
        setMode('confirm');
      } else if (step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setError('');
        setSuccess('You need to reset your password.');
        setMode('forgotPassword');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(message);
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    doSignIn(email, password);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, screenName || undefined);
      setSuccess('Account created! Check your email for a verification code.');
      setMode('confirm');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await confirmSignUp(email, code);
      // Auto sign-in after confirmation
      if (password) {
        setSuccess('Email verified! Signing you in...');
        doSignIn(email, password);
      } else {
        setSuccess('Email verified! You can now sign in.');
        resetForm('signIn', true);
        setLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed.';
      setError(message);
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    try {
      await resendConfirmationCode(email);
      setSuccess('A new verification code has been sent to your email.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend code.';
      setError(message);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await forgotPassword(email);
      setSuccess('A password reset code has been sent to your email.');
      setMode('resetPassword');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await confirmForgotPassword(email, code, password);
      setSuccess('Password reset! You can now sign in with your new password.');
      resetForm('signIn', true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderSignIn = () => (
    <Form onSubmit={handleSignIn}>
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

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Button type="submit" disabled={loading || !email || !password}>
        {loading ? 'Signing On...' : 'Sign On'}
      </Button>

      <LinksRow>
        <LinkButton type="button" onClick={() => resetForm('signUp', true)}>
          Get a Screen Name
        </LinkButton>
        <LinkButton type="button" onClick={() => resetForm('forgotPassword', true)}>
          Forgot Password?
        </LinkButton>
      </LinksRow>
    </Form>
  );

  const renderSignUp = () => (
    <Form onSubmit={handleSignUp}>
      <Field>
        <Label>Screen Name:</Label>
        <Input
          type="text"
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
          placeholder="Optional"
          autoFocus
          maxLength={64}
        />
      </Field>

      <Field>
        <Label>Email:</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
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
        <Hint>12+ characters, uppercase, lowercase, number, and symbol</Hint>
      </Field>

      <Field>
        <Label>Confirm Password:</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </Field>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Button type="submit" disabled={loading || !email || !password || !confirmPassword}>
        {loading ? 'Creating Account...' : 'Create Account'}
      </Button>

      <LinksRow>
        <LinkButton type="button" onClick={() => resetForm('signIn', true)}>
          Already have an account? Sign In
        </LinkButton>
      </LinksRow>
    </Form>
  );

  const renderConfirm = () => (
    <Form onSubmit={handleConfirm}>
      <Field>
        <Label>Verification Code:</Label>
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter 6-digit code"
          required
          autoFocus
          maxLength={6}
        />
        <Hint>Check your email for the verification code</Hint>
      </Field>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Button type="submit" disabled={loading || !code}>
        {loading ? 'Verifying...' : 'Verify Email'}
      </Button>

      <LinksRow>
        <LinkButton type="button" onClick={handleResendCode}>
          Resend Code
        </LinkButton>
        <LinkButton type="button" onClick={() => resetForm('signIn', true)}>
          Back to Sign In
        </LinkButton>
      </LinksRow>
    </Form>
  );

  const renderForgotPassword = () => (
    <Form onSubmit={handleForgotPassword}>
      <Field>
        <Label>Email:</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <Hint>We'll send a password reset code to this email</Hint>
      </Field>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Button type="submit" disabled={loading || !email}>
        {loading ? 'Sending Code...' : 'Send Reset Code'}
      </Button>

      <LinksRow>
        <LinkButton type="button" onClick={() => resetForm('signIn', true)}>
          Back to Sign In
        </LinkButton>
      </LinksRow>
    </Form>
  );

  const renderResetPassword = () => (
    <Form onSubmit={handleResetPassword}>
      <Field>
        <Label>Reset Code:</Label>
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code from email"
          required
          autoFocus
          maxLength={6}
        />
      </Field>

      <Field>
        <Label>New Password:</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Hint>12+ characters, uppercase, lowercase, number, and symbol</Hint>
      </Field>

      <Field>
        <Label>Confirm New Password:</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </Field>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <Button type="submit" disabled={loading || !code || !password || !confirmPassword}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </Button>

      <LinksRow>
        <LinkButton type="button" onClick={() => resetForm('signIn', true)}>
          Back to Sign In
        </LinkButton>
      </LinksRow>
    </Form>
  );

  const renderers: Record<AuthMode, () => React.ReactNode> = {
    signIn: renderSignIn,
    signUp: renderSignUp,
    confirm: renderConfirm,
    forgotPassword: renderForgotPassword,
    resetPassword: renderResetPassword,
  };

  return (
    <WindowFrame title={WINDOW_TITLES[mode]} width={440} height={WINDOW_HEIGHTS[mode]}>
      <Container>
        <LogoSection>
          <Logo src="/burnware-logo.png" alt="BurnWare" />
          <Title>BurnWare</Title>
          <Subtitle>Anonymous Inbox System</Subtitle>
        </LogoSection>

        {renderers[mode]()}
      </Container>
    </WindowFrame>
  );
};
