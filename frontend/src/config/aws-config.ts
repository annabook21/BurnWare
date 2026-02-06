/**
 * AWS Configuration for Frontend
 * File size: ~45 lines
 */

export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  },
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.burnware.example.com',
  },
};
