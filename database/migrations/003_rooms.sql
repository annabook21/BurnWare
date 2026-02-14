-- Migration: Add secure chat rooms
-- Creates rooms, room_invites, room_participants, room_messages tables

-- Rooms table (secure multi-party chat rooms)
CREATE TABLE rooms (
  room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_user_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,  -- 24h from creation
  locked_at TIMESTAMP,            -- Set after join window closes
  join_window_minutes INTEGER NOT NULL DEFAULT 15,
  max_participants INTEGER NOT NULL DEFAULT 10,
  participant_count INTEGER NOT NULL DEFAULT 0,  -- Trigger handles incrementing
  auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
  burned BOOLEAN NOT NULL DEFAULT FALSE,
  group_public_key TEXT NOT NULL,  -- Room's ECDH P-256 public key
  CONSTRAINT chk_display_name_length CHECK (char_length(display_name) >= 1),
  CONSTRAINT chk_max_participants CHECK (max_participants >= 2 AND max_participants <= 10),
  CONSTRAINT chk_join_window CHECK (join_window_minutes >= 5 AND join_window_minutes <= 60)
);

CREATE INDEX idx_rooms_creator ON rooms(creator_user_id);
CREATE INDEX idx_rooms_expires_at ON rooms(expires_at) WHERE burned = FALSE;
CREATE INDEX idx_rooms_burned ON rooms(burned) WHERE burned = FALSE;

-- Room invites table (one-time tokens)
CREATE TABLE room_invites (
  invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  invite_token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256(token)
  label VARCHAR(50),              -- "Alice", "Bob" for creator reference
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,  -- Same as room lock time
  redeemed_at TIMESTAMP,          -- Set on first use
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_room_invites_room ON room_invites(room_id);
CREATE INDEX idx_room_invites_token_hash ON room_invites(invite_token_hash);
CREATE INDEX idx_room_invites_expires ON room_invites(expires_at) WHERE redeemed_at IS NULL AND revoked = FALSE;

-- Room participants table
CREATE TABLE room_participants (
  participant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  invite_id UUID REFERENCES room_invites(invite_id),
  anonymous_id VARCHAR(64) NOT NULL,  -- Random per-room identifier
  display_name VARCHAR(50),
  public_key TEXT NOT NULL,           -- Participant's ECDH public key
  wrapped_group_key TEXT,             -- Group key encrypted for this participant
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
  joined_at TIMESTAMP,
  watermark_seed VARCHAR(64) NOT NULL,  -- Per-user invisible watermark
  is_creator BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT chk_anonymous_id_length CHECK (char_length(anonymous_id) >= 8)
);

CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_status ON room_participants(room_id, status);
CREATE INDEX idx_room_participants_anonymous ON room_participants(room_id, anonymous_id);
CREATE UNIQUE INDEX idx_room_participants_room_invite ON room_participants(room_id, invite_id) WHERE invite_id IS NOT NULL;

-- Room messages table
CREATE TABLE room_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES room_participants(participant_id),
  ciphertext TEXT NOT NULL,       -- AES-256-GCM encrypted
  nonce VARCHAR(32) NOT NULL,     -- 12-byte nonce (24 hex chars)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ciphertext_length CHECK (char_length(ciphertext) >= 1 AND char_length(ciphertext) <= 20000),
  CONSTRAINT chk_nonce_length CHECK (char_length(nonce) >= 24)
);

CREATE INDEX idx_room_messages_room ON room_messages(room_id);
CREATE INDEX idx_room_messages_created ON room_messages(room_id, created_at);

-- Trigger for rooms updated_at
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment room participant count
CREATE OR REPLACE FUNCTION increment_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    UPDATE rooms SET participant_count = participant_count + 1 WHERE room_id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_room_participants AFTER INSERT OR UPDATE ON room_participants
  FOR EACH ROW EXECUTE FUNCTION increment_room_participant_count();

-- Function to auto-lock rooms after join window
CREATE OR REPLACE FUNCTION auto_lock_rooms()
RETURNS INTEGER AS $$
DECLARE
  locked_count INTEGER;
BEGIN
  UPDATE rooms
  SET locked_at = CURRENT_TIMESTAMP
  WHERE locked_at IS NULL
    AND burned = FALSE
    AND created_at + (join_window_minutes || ' minutes')::INTERVAL < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS locked_count = ROW_COUNT;
  RETURN locked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired rooms (24h TTL)
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired rooms (cascades to invites, participants, messages)
  DELETE FROM rooms
  WHERE expires_at < CURRENT_TIMESTAMP
    AND burned = FALSE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fix any rooms with incorrect participant_count (from DEFAULT 1 bug)
UPDATE rooms r SET participant_count = (
  SELECT COUNT(*) FROM room_participants p
  WHERE p.room_id = r.room_id AND p.status = 'approved'
);

-- Comments for documentation
COMMENT ON TABLE rooms IS 'Secure multi-party chat rooms with 24h auto-expiry';
COMMENT ON TABLE room_invites IS 'One-time invite tokens (SHA-256 hash stored)';
COMMENT ON TABLE room_participants IS 'Room participants with E2E encryption keys';
COMMENT ON TABLE room_messages IS 'AES-256-GCM encrypted room messages';
