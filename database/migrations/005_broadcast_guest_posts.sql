-- 005: Allow guest posting on broadcast channels
-- Non-blocking in PG 11+ (DEFAULT stored in catalog, no table rewrite)

ALTER TABLE broadcast_channels
  ADD COLUMN allow_guest_posts BOOLEAN NOT NULL DEFAULT FALSE;
