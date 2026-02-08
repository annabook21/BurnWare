-- BurnWare Database Schema
-- PostgreSQL 15.4
-- Reference: https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/rds.html

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (stores Cognito user metadata)
CREATE TABLE users (
  user_id VARCHAR(128) PRIMARY KEY,  -- Cognito sub
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Links table (owner-created short links/QR codes)
CREATE TABLE links (
  link_id VARCHAR(16) PRIMARY KEY,  -- Cryptographically secure random token
  owner_user_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  burned BOOLEAN NOT NULL DEFAULT FALSE,
  message_count INTEGER NOT NULL DEFAULT 0,
  qr_code_url VARCHAR(500),  -- S3 signed URL or path
  public_key TEXT,  -- ECDH P-256 public key (base64 raw), required for E2EE
  CONSTRAINT chk_display_name_length CHECK (char_length(display_name) >= 1),
  CONSTRAINT chk_link_id_format CHECK (link_id ~ '^[A-Za-z0-9_-]+$')
);

CREATE INDEX idx_links_owner ON links(owner_user_id);
CREATE INDEX idx_links_expires_at ON links(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_links_burned ON links(burned) WHERE burned = FALSE;
CREATE INDEX idx_links_created_at ON links(created_at);

-- Threads table (conversation threads)
CREATE TABLE threads (
  thread_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id VARCHAR(16) NOT NULL REFERENCES links(link_id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  burned BOOLEAN NOT NULL DEFAULT FALSE,
  message_count INTEGER NOT NULL DEFAULT 0,
  sender_anonymous_id VARCHAR(64) NOT NULL,  -- Random per-thread identifier (not derived from sender data)
  sender_public_key TEXT,  -- Sender's ECDH P-256 ephemeral public key (base64 raw), for E2EE replies
  CONSTRAINT chk_sender_id_length CHECK (char_length(sender_anonymous_id) >= 8)
);

CREATE INDEX idx_threads_link_id ON threads(link_id);
CREATE INDEX idx_threads_created_at ON threads(created_at);
CREATE INDEX idx_threads_burned ON threads(burned) WHERE burned = FALSE;
-- Removed: idx_threads_sender index — sender_anonymous_id is random per-thread,
-- cross-thread sender lookups are intentionally not supported for anonymity.

-- Messages table (individual messages in threads)
CREATE TABLE messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('anonymous', 'owner')),
  sender_id VARCHAR(128),  -- Cognito sub for owner, NULL for anonymous
  CONSTRAINT chk_message_length CHECK (char_length(content) >= 1 AND char_length(content) <= 10000)
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_sender_type ON messages(sender_type);

-- Audit log table (for compliance and security)
CREATE TABLE audit_log (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,  -- 'link_created', 'thread_burned', etc.
  user_id VARCHAR(128),
  resource_type VARCHAR(50),
  resource_id VARCHAR(128),
  event_data JSONB,
  -- ip_address column removed — storing raw IPs undermines sender anonymity
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_links_updated_at BEFORE UPDATE ON links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE threads SET message_count = message_count + 1 WHERE thread_id = NEW.thread_id;
  UPDATE links SET message_count = message_count + 1 
    WHERE link_id = (SELECT link_id FROM threads WHERE thread_id = NEW.thread_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_thread_message_count AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION increment_message_count();

-- Function to clean up expired links (call daily)
CREATE OR REPLACE FUNCTION cleanup_expired_links()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM links
  WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND burned = FALSE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores Cognito user metadata';
COMMENT ON TABLE links IS 'Owner-created short links/QR codes for anonymous inbox';
COMMENT ON TABLE threads IS 'Conversation threads initiated by anonymous senders';
COMMENT ON TABLE messages IS 'Individual messages within threads';
COMMENT ON TABLE audit_log IS 'Audit trail for compliance and security monitoring';
