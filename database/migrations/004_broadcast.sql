-- Migration: Add broadcast channels and posts
-- Creates broadcast_channels and broadcast_posts tables (no participant/invite tables)

-- Broadcast channels (read URL = /b/:channel_id; post token stored as hash)
CREATE TABLE broadcast_channels (
  channel_id VARCHAR(16) PRIMARY KEY,
  post_token_hash VARCHAR(64) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  burned BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id VARCHAR(128) REFERENCES users(user_id) ON DELETE SET NULL,
  qr_code_url VARCHAR(500),
  CONSTRAINT chk_broadcast_display_name_length CHECK (char_length(display_name) >= 1),
  CONSTRAINT chk_broadcast_channel_id_format CHECK (channel_id ~ '^[A-Za-z0-9_-]+$')
);

CREATE INDEX idx_broadcast_channels_owner ON broadcast_channels(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_broadcast_channels_expires ON broadcast_channels(expires_at) WHERE expires_at IS NOT NULL AND burned = FALSE;
CREATE INDEX idx_broadcast_channels_burned ON broadcast_channels(burned) WHERE burned = FALSE;

-- Broadcast posts (plaintext content per design)
CREATE TABLE broadcast_posts (
  post_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id VARCHAR(16) NOT NULL REFERENCES broadcast_channels(channel_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_broadcast_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 10000)
);

CREATE INDEX idx_broadcast_posts_channel_created ON broadcast_posts(channel_id, created_at DESC);

COMMENT ON TABLE broadcast_channels IS 'Broadcast channels: read URL /b/:channel_id; post token hashed for add/burn';
COMMENT ON TABLE broadcast_posts IS 'Plaintext posts in a broadcast channel; newest first';
