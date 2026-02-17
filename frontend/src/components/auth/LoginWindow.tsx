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
import {
  SignInForm,
  SignUpForm,
  ConfirmForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from './LoginForms';

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

const COGNITO_ERROR_MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'Incorrect email or password.',
  UserNotConfirmedException: 'Please verify your email first.',
  UserNotFoundException: 'No account found with this email.',
  PasswordResetRequiredException: 'Password reset required. Check your email.',
  TooManyRequestsException: 'Too many attempts. Please try again later.',
  LimitExceededException: 'Too many attempts. Please try again later.',
  InvalidPasswordException: 'Password does not meet requirements.',
  UsernameExistsException: 'An account with this email already exists.',
  CodeMismatchException: 'Invalid verification code.',
  ExpiredCodeException: 'Verification code has expired. Please request a new one.',
};

function getCognitoErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const friendlyMessage = COGNITO_ERROR_MESSAGES[err.name];
    if (friendlyMessage) return friendlyMessage;
    if (err.message.includes('Network')) return 'Check your internet connection.';
    return err.message;
  }
  return 'An unexpected error occurred.';
}

const WINDOW_TITLES: Record<AuthMode, string> = {
  signIn: 'Sign On to BurnWare',
  signUp: 'Get a Screen Name',
  confirm: 'Verify Your Email',
  forgotPassword: 'Forgot Password',
  resetPassword: 'Reset Password',
};

const WINDOW_HEIGHTS: Record<AuthMode, number> = {
  signIn: 520,
  signUp: 680,
  confirm: 440,
  forgotPassword: 420,
  resetPassword: 600,
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
      setError(getCognitoErrorMessage(err));
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
      setError(getCognitoErrorMessage(err));
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
      if (password) {
        setSuccess('Email verified! Signing you in...');
        doSignIn(email, password);
      } else {
        setSuccess('Email verified! You can now sign in.');
        resetForm('signIn', true);
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(getCognitoErrorMessage(err));
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
      setError(getCognitoErrorMessage(err));
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
      setError(getCognitoErrorMessage(err));
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
      setError(getCognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const shared = { loading, error, success };

  const renderForm = () => {
    switch (mode) {
      case 'signIn':
        return (
          <SignInForm {...shared} email={email} setEmail={setEmail} password={password} setPassword={setPassword}
            onSubmit={handleSignIn} onSignUp={() => resetForm('signUp', true)} onForgotPassword={() => resetForm('forgotPassword', true)} />
        );
      case 'signUp':
        return (
          <SignUpForm {...shared} email={email} setEmail={setEmail} screenName={screenName} setScreenName={setScreenName}
            password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
            onSubmit={handleSignUp} onSignIn={() => resetForm('signIn', true)} />
        );
      case 'confirm':
        return (
          <ConfirmForm {...shared} code={code} setCode={setCode}
            onSubmit={handleConfirm} onResend={handleResendCode} onSignIn={() => resetForm('signIn', true)} />
        );
      case 'forgotPassword':
        return (
          <ForgotPasswordForm {...shared} email={email} setEmail={setEmail}
            onSubmit={handleForgotPassword} onSignIn={() => resetForm('signIn', true)} />
        );
      case 'resetPassword':
        return (
          <ResetPasswordForm {...shared} code={code} setCode={setCode} password={password} setPassword={setPassword}
            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
            onSubmit={handleResetPassword} onSignIn={() => resetForm('signIn', true)} />
        );
    }
  };

  return (
    <WindowFrame title={WINDOW_TITLES[mode]} width={440} height={WINDOW_HEIGHTS[mode]}>
      <Container>
        <LogoSection>
          <Logo src="/burnware-logo.png" alt="BurnWare" />
          <Title>BurnWare</Title>
          <Subtitle>Anonymous inbox. Share a link—anyone can message you, no account needed.</Subtitle>
        </LogoSection>

        {renderForm()}
      </Container>
    </WindowFrame>
  );
};
