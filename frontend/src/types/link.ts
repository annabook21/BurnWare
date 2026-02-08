/**
 * Shared types for BurnWare links (dashboard / buddy list)
 */

export interface Link {
  link_id: string;
  display_name: string;
  description?: string;
  message_count: number;
  expires_at?: string;
  burned: boolean;
  qr_code_url?: string;
  public_key?: string;
}
