/**
 * Login Form Components
 * Individual auth forms extracted from LoginWindow for file-size compliance
 */

import React from 'react';
import styled from 'styled-components';
import { Button98, LinkButton as LinkBtn } from '../aim-ui/Button98';
import { FullInput } from '../aim-ui/FormField';
import { aimTheme } from '../../theme/aim-theme';

// --- Styled components shared across all forms ---

export const Form = styled.form`
  width: 100%;
  max-width: 300px;
`;

export const Field = styled.div`
  margin-bottom: ${aimTheme.spacing.lg};
`;

export const Label = styled.label`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.xs};
  display: block;
`;

export const LoginInput = styled(FullInput)`
  &:focus {
    outline: 1px solid ${aimTheme.colors.blue};
    outline-offset: 0;
  }
`;

export const SubmitButton = styled(Button98)`
  width: 100%;
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-top: ${aimTheme.spacing.md};
`;

export const ErrorMessage = styled.div`
  color: ${aimTheme.colors.fireRed};
  font-size: ${aimTheme.fonts.size.small};
  margin-top: ${aimTheme.spacing.sm};
  padding: ${aimTheme.spacing.sm};
  background: #FFE0E0;
  border: 1px solid ${aimTheme.colors.fireRed};
`;

export const SuccessMessage = styled.div`
  color: #006600;
  font-size: ${aimTheme.fonts.size.small};
  margin-top: ${aimTheme.spacing.sm};
  padding: ${aimTheme.spacing.sm};
  background: #E0FFE0;
  border: 1px solid #006600;
`;

export const LinksRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${aimTheme.spacing.lg};
`;

export const Hint = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: ${aimTheme.colors.darkGray};
  margin-top: ${aimTheme.spacing.xs};
`;

const RuleList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${aimTheme.spacing.xs} 0 0 0;
`;

const RuleLine = styled.li<{ $passed: boolean }>`
  font-size: ${aimTheme.fonts.size.tiny};
  color: ${({ $passed }) => ($passed ? '#006600' : aimTheme.colors.darkGray)};
  line-height: 1.6;
`;

const PASSWORD_RULES = [
  { label: '12+ characters', test: (pw: string) => pw.length >= 12 },
  { label: 'Uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'Number', test: (pw: string) => /\d/.test(pw) },
  { label: 'Symbol', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
];

const PasswordRules: React.FC<{ password: string }> = ({ password }) =>
  password ? (
    <RuleList>
      {PASSWORD_RULES.map((rule) => (
        <RuleLine key={rule.label} $passed={rule.test(password)}>
          {rule.test(password) ? '\u2713' : '\u2717'} {rule.label}
        </RuleLine>
      ))}
    </RuleList>
  ) : (
    <Hint>12+ characters, uppercase, lowercase, number, and symbol</Hint>
  );

const StatusMessages: React.FC<{ error: string; success: string }> = ({ error, success }) => (
  <>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    {success && <SuccessMessage>{success}</SuccessMessage>}
  </>
);

// --- Form components ---

interface SignInFormProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: React.FormEvent) => void;
  onSignUp: () => void;
  onForgotPassword: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  email, setEmail, password, setPassword, loading, error, success,
  onSubmit, onSignUp, onForgotPassword,
}) => (
  <Form onSubmit={onSubmit}>
    <Field>
      <Label>Email:</Label>
      <LoginInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
    </Field>
    <Field>
      <Label>Password:</Label>
      <LoginInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    </Field>
    <StatusMessages error={error} success={success} />
    <SubmitButton type="submit" disabled={loading || !email || !password}>
      {loading ? 'Signing On...' : 'Sign On'}
    </SubmitButton>
    <LinksRow>
      <LinkBtn type="button" onClick={onSignUp}>Get a Screen Name</LinkBtn>
      <LinkBtn type="button" onClick={onForgotPassword}>Forgot Password?</LinkBtn>
    </LinksRow>
  </Form>
);

interface SignUpFormProps {
  email: string;
  setEmail: (v: string) => void;
  screenName: string;
  setScreenName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: React.FormEvent) => void;
  onSignIn: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  email, setEmail, screenName, setScreenName, password, setPassword,
  confirmPassword, setConfirmPassword, loading, error, success, onSubmit, onSignIn,
}) => (
  <Form onSubmit={onSubmit}>
    <Field>
      <Label>Screen Name:</Label>
      <LoginInput type="text" value={screenName} onChange={(e) => setScreenName(e.target.value)} placeholder="Optional" autoFocus maxLength={64} />
    </Field>
    <Field>
      <Label>Email:</Label>
      <LoginInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
    </Field>
    <Field>
      <Label>Password:</Label>
      <LoginInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <PasswordRules password={password} />
    </Field>
    <Field>
      <Label>Confirm Password:</Label>
      <LoginInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
    </Field>
    <StatusMessages error={error} success={success} />
    <SubmitButton type="submit" disabled={loading || !email || !password || !confirmPassword}>
      {loading ? 'Creating Account...' : 'Create Account'}
    </SubmitButton>
    <LinksRow>
      <LinkBtn type="button" onClick={onSignIn}>Already have an account? Sign In</LinkBtn>
    </LinksRow>
  </Form>
);

interface ConfirmFormProps {
  code: string;
  setCode: (v: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onSignIn: () => void;
}

export const ConfirmForm: React.FC<ConfirmFormProps> = ({
  code, setCode, loading, error, success, onSubmit, onResend, onSignIn,
}) => (
  <Form onSubmit={onSubmit}>
    <Field>
      <Label>Verification Code:</Label>
      <LoginInput type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code" required autoFocus maxLength={6} />
      <Hint>Check your email for the verification code</Hint>
    </Field>
    <StatusMessages error={error} success={success} />
    <SubmitButton type="submit" disabled={loading || !code}>
      {loading ? 'Verifying...' : 'Verify Email'}
    </SubmitButton>
    <LinksRow>
      <LinkBtn type="button" onClick={onResend}>Resend Code</LinkBtn>
      <LinkBtn type="button" onClick={onSignIn}>Back to Sign In</LinkBtn>
    </LinksRow>
  </Form>
);

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: React.FormEvent) => void;
  onSignIn: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email, setEmail, loading, error, success, onSubmit, onSignIn,
}) => (
  <Form onSubmit={onSubmit}>
    <Field>
      <Label>Email:</Label>
      <LoginInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <Hint>We'll send a password reset code to this email</Hint>
    </Field>
    <StatusMessages error={error} success={success} />
    <SubmitButton type="submit" disabled={loading || !email}>
      {loading ? 'Sending Code...' : 'Send Reset Code'}
    </SubmitButton>
    <LinksRow>
      <LinkBtn type="button" onClick={onSignIn}>Back to Sign In</LinkBtn>
    </LinksRow>
  </Form>
);

interface ResetPasswordFormProps {
  code: string;
  setCode: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: React.FormEvent) => void;
  onSignIn: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  code, setCode, password, setPassword, confirmPassword, setConfirmPassword,
  loading, error, success, onSubmit, onSignIn,
}) => (
  <Form onSubmit={onSubmit}>
    <Field>
      <Label>Reset Code:</Label>
      <LoginInput type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code from email" required autoFocus maxLength={6} />
    </Field>
    <Field>
      <Label>New Password:</Label>
      <LoginInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <PasswordRules password={password} />
    </Field>
    <Field>
      <Label>Confirm New Password:</Label>
      <LoginInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
    </Field>
    <StatusMessages error={error} success={success} />
    <SubmitButton type="submit" disabled={loading || !code || !password || !confirmPassword}>
      {loading ? 'Resetting...' : 'Reset Password'}
    </SubmitButton>
    <LinksRow>
      <LinkBtn type="button" onClick={onSignIn}>Back to Sign In</LinkBtn>
    </LinksRow>
  </Form>
);
