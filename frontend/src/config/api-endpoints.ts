/**
 * Centralized API endpoint definitions
 */

const API_BASE = '/api/v1';

export const endpoints = {
  dashboard: {
    links: () => `${API_BASE}/dashboard/links`,
    linkCounts: () => `${API_BASE}/dashboard/links/counts`,
    link: (linkId: string) => `${API_BASE}/dashboard/links/${linkId}`,
    threads: (linkId: string) => `${API_BASE}/dashboard/links/${linkId}/threads`,
    thread: (threadId: string) => `${API_BASE}/dashboard/threads/${threadId}`,
    threadReply: (threadId: string) => `${API_BASE}/dashboard/threads/${threadId}/reply`,
    threadBurn: (threadId: string) => `${API_BASE}/dashboard/threads/${threadId}/burn`,
  },
  public: {
    linkMetadata: (linkId: string) => `${API_BASE}/link/${linkId}/metadata`,
    send: () => `${API_BASE}/send`,
    thread: (threadId: string) => `${API_BASE}/thread/${threadId}`,
  },
};
