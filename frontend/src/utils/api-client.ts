/**
 * API Client
 * Axios instance with retry logic for resilient API calls
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import { awsConfig } from '../config/aws-config';

function isHtmlResponse(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  const trimmed = data.trimStart();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html');
}

const apiClient = axios.create({
  baseURL: awsConfig.api.baseUrl,
});

apiClient.interceptors.response.use(
  (response) => {
    if (isHtmlResponse(response.data)) {
      const err = new Error('API returned HTML; request may have hit the SPA origin. Ensure /api/* is routed to the backend.') as Error & { code?: string; response?: unknown };
      err.code = 'API_UNREACHABLE';
      err.response = response;
      return Promise.reject(err);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (error.response?.status !== undefined && error.response.status >= 500),
});

export default apiClient;
