-- 0026_blocks.sql — user-to-user blocking
-- Closes a safety gap: there was no way to hide/block another user. Storage is
-- directional (who blocked whom, for unblock + a future "blocked users" list),
-- but the EFFECT is checked symmetrically everywhere it matters: map visibility
-- (discovery.service.ts) and the messaging gate (messaging.service.ts) both
-- treat "either direction blocked" as blocked.

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Both discovery and messaging check both directions on every request —
-- index the reverse-lookup column too.
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);
