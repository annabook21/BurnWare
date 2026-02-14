/**
 * Shared types for BurnWare rooms (secure multi-party chat)
 */

export interface Room {
  room_id: string;
  display_name: string;
  description?: string;
  created_at: string;
  expires_at: string;
  locked_at?: string;
  join_window_minutes: number;
  max_participants: number;
  participant_count: number;
  auto_approve: boolean;
  burned: boolean;
}

export interface RoomParticipant {
  participant_id: string;
  anonymous_id: string;
  display_name?: string;
  public_key: string;
  status: 'pending' | 'approved' | 'rejected';
  is_creator: boolean;
  created_at: string;
}

export interface RoomInvite {
  invite_id: string;
  label?: string;
  created_at: string;
  expires_at: string;
  redeemed: boolean;
  revoked: boolean;
}

export interface GeneratedInvite {
  invite_id: string;
  token: string; // Only returned once, not stored server-side
  label?: string;
  expires_at: string;
}

export interface RoomMessage {
  message_id: string;
  room_id: string;
  anonymous_id: string;
  display_name?: string;
  ciphertext: string;
  nonce: string;
  created_at: string;
}

export interface JoinRoomResult {
  participant_id: string;
  anonymous_id: string;
  room_id: string;
  status: 'pending' | 'approved';
  wrapped_group_key?: string;
  watermark_seed: string;
  room_public_key: string;
  participants: Array<{
    anonymous_id: string;
    display_name?: string;
    public_key: string;
  }>;
}

export interface ParticipantStatus {
  status: 'pending' | 'approved' | 'rejected';
  wrapped_group_key?: string;
  participants?: Array<{
    anonymous_id: string;
    display_name?: string;
    public_key: string;
  }>;
}
