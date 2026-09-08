-- 0037_conversation_kind_members.sql
-- Schema prep for group chat (P4). Runtime remains DM-only; members backfilled
-- from participant_ids so future group APIs can read a normalized membership table.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dm';

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('dm', 'group'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member')),
  muted           boolean NOT NULL DEFAULT false,
  last_read_at    timestamptz,
  joined_at       timestamptz NOT NULL DEFAULT NOW(),
  left_at         timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON conversation_members (user_id)
  WHERE left_at IS NULL;

-- Backfill active DM membership from participant_ids (idempotent).
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
SELECT c.id, unnest(c.participant_ids), 'member', c.created_at
  FROM conversations c
ON CONFLICT (conversation_id, user_id) DO NOTHING;
