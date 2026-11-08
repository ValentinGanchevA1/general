-- Optimize the per-message safety check introduced for pausing Dating.
-- Dating-created conversations reuse dm rows, and chat authorization checks
-- dating_matches by conversation_id on every request and realtime fanout.
-- Partial index avoids nulls for likes that did not result in a chat.
CREATE INDEX IF NOT EXISTS dating_matches_conversation_id_idx
  ON dating_matches (conversation_id)
  WHERE conversation_id IS NOT NULL;
