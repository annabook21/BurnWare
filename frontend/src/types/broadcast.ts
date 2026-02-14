/**
 * Types for broadcast channels and posts
 */

export interface BroadcastChannel {
  channel_id: string;
  display_name: string;
  read_url: string;
  created_at: string;
  burned: boolean;
}

export interface BroadcastPost {
  post_id: string;
  content: string;
  created_at: string;
}

export interface CreateBroadcastChannelResult {
  channel_id: string;
  read_url: string;
  post_token: string;
  display_name: string;
  encryption_key?: string; // Client-generated AES-256 key, stored in URL fragment
}
