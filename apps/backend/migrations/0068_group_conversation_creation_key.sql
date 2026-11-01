-- 0068_group_conversation_creation_key.sql
-- Group creation retries are keyed by the authenticated creator + client request UUID.
-- This prevents duplicate groups on network retry without conflating two legitimate
-- groups that happen to have the same title/member set.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS creation_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_group_creation_key_unique
  ON conversations (created_by, creation_key)
  WHERE kind = 'group' AND creation_key IS NOT NULL;
