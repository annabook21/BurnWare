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
    keyBackup: (linkId: string) => `${API_BASE}/dashboard/links/${linkId}/key-backup`,
    // Room management (creator endpoints)
    rooms: () => `${API_BASE}/dashboard/rooms`,
    room: (roomId: string) => `${API_BASE}/dashboard/rooms/${roomId}`,
    roomLock: (roomId: string) => `${API_BASE}/dashboard/rooms/${roomId}/lock`,
    roomBurn: (roomId: string) => `${API_BASE}/dashboard/rooms/${roomId}/burn`,
    roomInvites: (roomId: string) => `${API_BASE}/dashboard/rooms/${roomId}/invites`,
    roomInvite: (roomId: string, inviteId: string) => `${API_BASE}/dashboard/rooms/${roomId}/invites/${inviteId}`,
    roomPending: (roomId: string) => `${API_BASE}/dashboard/rooms/${roomId}/pending`,
    roomApprove: (roomId: string, participantId: string) =>
      `${API_BASE}/dashboard/rooms/${roomId}/participants/${participantId}/approve`,
    roomReject: (roomId: string, participantId: string) =>
      `${API_BASE}/dashboard/rooms/${roomId}/participants/${participantId}/reject`,
    // Auto-approve key distribution
    roomNeedsKeys: (roomId: string) => `${API_BASE}/dashboard/rooms/${roomId}/needs-keys`,
    roomSetKey: (roomId: string, participantId: string) =>
      `${API_BASE}/dashboard/rooms/${roomId}/participants/${participantId}/set-key`,
    // Broadcast (owner channels list)
    broadcastChannels: () => `${API_BASE}/dashboard/broadcast`,
    broadcastChannel: (channelId: string) => `${API_BASE}/dashboard/broadcast/${channelId}`,
  },
  public: {
    linkMetadata: (linkId: string) => `${API_BASE}/link/${linkId}/metadata`,
    send: () => `${API_BASE}/send`,
    thread: (threadId: string) => `${API_BASE}/thread/${threadId}`,
    threadReply: (threadId: string) => `${API_BASE}/thread/${threadId}/reply`,
    threadUnlock: (threadId: string) => `${API_BASE}/thread/${threadId}/unlock`,
    // Room public endpoints (participant join/chat)
    roomJoin: () => `${API_BASE}/rooms/join`,
    roomStatus: (roomId: string) => `${API_BASE}/rooms/${roomId}/status`,
    roomInfo: (roomId: string) => `${API_BASE}/rooms/${roomId}/info`,
    roomMessages: (roomId: string) => `${API_BASE}/rooms/${roomId}/messages`,
    // Broadcast (public)
    broadcastCreate: () => `${API_BASE}/broadcast`,
    broadcastPosts: (channelId: string) => `${API_BASE}/broadcast/${channelId}/posts`,
    broadcastAddPost: (channelId: string) => `${API_BASE}/broadcast/${channelId}/posts`,
    broadcastBurn: (channelId: string) => `${API_BASE}/broadcast/${channelId}/burn`,
  },
};
