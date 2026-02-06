/**
 * Cognito Configuration
 * Authentication helpers using @aws-amplify/auth v6
 * Migrated from amazon-cognito-identity-js (EOL April 2026)
 */

import { Amplify } from 'aws-amplify';
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  resetPassword,
  confirmResetPassword,
  fetchAuthSession,
  getCurrentUser as amplifyGetCurrentUser,
} from 'aws-amplify/auth';
import { awsConfig } from './aws-config';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsConfig.cognito.userPoolId,
      userPoolClientId: awsConfig.cognito.userPoolClientId,
    },
  },
});

/**
 * Get a fresh access token JWT.
 * Automatically refreshes expired tokens using the refresh token.
 * Returns null if no session exists or refresh token has expired.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/**
 * Sign in with email and password.
 * Returns the Amplify SignInOutput for callers to check nextStep.
 */
export async function signIn(email: string, password: string) {
  return amplifySignIn({ username: email, password });
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await amplifySignOut();
}

/**
 * Get the current authenticated user, or null if not signed in.
 */
export async function getCurrentUser() {
  try {
    return await amplifyGetCurrentUser();
  } catch {
    return null;
  }
}

/**
 * Sign up a new user with email and password.
 */
export async function signUp(email: string, password: string, screenName?: string): Promise<void> {
  await amplifySignUp({
    username: email,
    password,
    options: screenName
      ? { userAttributes: { preferred_username: screenName } }
      : undefined,
  });
}

/**
 * Confirm a signup with the verification code sent to the user's email.
 */
export async function confirmSignUp(email: string, code: string): Promise<void> {
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

/**
 * Resend the confirmation code for a pending signup.
 */
export async function resendConfirmationCode(email: string): Promise<void> {
  await resendSignUpCode({ username: email });
}

/**
 * Initiate forgot password flow — sends a reset code to the user's email.
 */
export async function forgotPassword(email: string): Promise<void> {
  await resetPassword({ username: email });
}

/**
 * Confirm a password reset with the verification code and new password.
 */
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
}
