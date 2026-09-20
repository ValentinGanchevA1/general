-- 0043: dismiss / snooze for friend suggestions (people-you-may-know)
-- Permanent dismiss: snooze_until IS NULL.
-- Snooze: snooze_until = future timestamp; row ignored after it passes (can reappear).

CREATE TABLE IF NOT EXISTS friend_suggestion_dismissals (
  actor_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT NOW(),
  -- NULL = permanent dismiss; otherwise hide until this time.
  snooze_until timestamptz,
  PRIMARY KEY (actor_id, target_id),
  CHECK (actor_id <> target_id)
);

-- Plain actor index (NOW() is STABLE — cannot appear in partial index predicates).
-- Active filter (snooze_until IS NULL OR snooze_until > NOW()) stays in queries.
CREATE INDEX IF NOT EXISTS friend_suggestion_dismissals_actor_idx
  ON friend_suggestion_dismissals (actor_id);
