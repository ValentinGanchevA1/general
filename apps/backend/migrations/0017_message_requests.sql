-- 0017_message_requests.sql — Interest-based message requests.
--
-- Adds a two-state lifecycle to conversations so a shared-interest "message
-- request" can exist before the recipient consents:
--   pending  → initiator may send exactly one message; recipient's first reply
--              promotes it to accepted.
--   accepted → normal two-way chat.
--
-- Every conversation that exists today was born from a reciprocal wave (a
-- match), so the backfill default is 'accepted' — no existing chat is gated.
-- Idempotent: guarded ADD COLUMN + CHECK so re-runs are safe.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS initiated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('pending', 'accepted'));

-- Inbox needs to surface a user's pending requests cheaply.
CREATE INDEX IF NOT EXISTS conversations_status_idx
  ON conversations (status)
  WHERE status = 'pending';
