/**
 * Shared types for BurnWare messages (threads / chat)
 */

export interface Message {
  message_id: string;
  content: string;
  sender_type: 'anonymous' | 'owner';
  created_at: string;
}
