/**
 * API Client
 * Axios instance with retry logic for resilient API calls
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import { awsConfig } from '../config/aws-config';

const apiClient = axios.create({
  baseURL: awsConfig.api.baseUrl,
});

axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (error.response?.status !== undefined && error.response.status >= 500),
});

export default apiClient;
