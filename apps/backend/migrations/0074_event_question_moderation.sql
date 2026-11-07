-- Q&A moderation: preserve referential/audit history while removing public visibility.
ALTER TABLE event_questions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS event_questions_visible_event_idx
  ON event_questions (event_id, created_at)
  WHERE deleted_at IS NULL;
