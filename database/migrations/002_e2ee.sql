-- Migration: Add E2EE support
-- Adds public_key to links, sender_public_key to threads, increases message content limit

ALTER TABLE links ADD COLUMN public_key TEXT;
ALTER TABLE threads ADD COLUMN sender_public_key TEXT;

ALTER TABLE messages DROP CONSTRAINT chk_message_length;
ALTER TABLE messages ADD CONSTRAINT chk_message_length
  CHECK (char_length(content) >= 1 AND char_length(content) <= 10000);
