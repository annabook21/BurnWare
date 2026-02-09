/**
 * AWS Configuration for Frontend
 * File size: ~45 lines
 */

function requireEnv(key: string): string {
  const val = import.meta.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  cognito: {
    userPoolId: requireEnv('VITE_COGNITO_USER_POOL_ID'),
    userPoolClientId: requireEnv('VITE_COGNITO_CLIENT_ID'),
  },
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '', // Empty = same-origin
  },
  appSync: {
    httpDns: import.meta.env.VITE_APPSYNC_HTTP_DOMAIN || '',
    realtimeDns: import.meta.env.VITE_APPSYNC_REALTIME_DOMAIN || '',
    apiKey: import.meta.env.VITE_APPSYNC_API_KEY || '',
  },
};
