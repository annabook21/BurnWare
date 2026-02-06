/**
 * Cognito Configuration
 * File size: ~45 lines
 */

import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { awsConfig } from './aws-config';

const poolData = {
  UserPoolId: awsConfig.cognito.userPoolId,
  ClientId: awsConfig.cognito.userPoolClientId,
};

export const userPool = new CognitoUserPool(poolData);

export const getCurrentUser = () => {
  return userPool.getCurrentUser();
};

export const signOut = () => {
  const user = getCurrentUser();
  if (user) {
    user.signOut();
  }
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
};
