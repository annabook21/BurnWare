/**
 * AWS Configuration for Frontend
 *
 * AppSync values come from two sources (runtime wins over build-time):
 *   1. runtime-config.json — deployed to S3 by CDK with resolved CloudFormation values
 *   2. VITE_APPSYNC_* env vars in .env — used for local dev (npm run dev)
 *
 * Call loadRuntimeConfig() before app mount to populate runtime values.
 */

/** Runtime config loaded from /runtime-config.json (deployed by CDK) */
let runtimeAppSync: { httpDns?: string; realtimeDns?: string; apiKey?: string } = {};

/** Fetch runtime-config.json. Safe to call multiple times; no-ops on failure. */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const res = await fetch('/runtime-config.json');
    if (res.ok) {
      const json = await res.json();
      runtimeAppSync = json?.appSync ?? {};
    }
  } catch {
    // Local dev or offline — fall back to .env values
  }
}

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
  get appSync() {
    return {
      httpDns: runtimeAppSync.httpDns || import.meta.env.VITE_APPSYNC_HTTP_DOMAIN || '',
      realtimeDns: runtimeAppSync.realtimeDns || import.meta.env.VITE_APPSYNC_REALTIME_DOMAIN || '',
      apiKey: runtimeAppSync.apiKey || import.meta.env.VITE_APPSYNC_API_KEY || '',
    };
  },
};
