-- 0011_challenges.sql — Daily challenge progress.
--
-- The challenge catalog and "which 3 today" live in code (@g88/shared); this
-- table only tracks per-user progress for a given (challenge, day). completed_at
-- gates the one-time bonus XP award (which itself dedupes in xp_events).

CREATE TABLE challenge_progress (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id  text NOT NULL,
  day           date NOT NULL DEFAULT CURRENT_DATE,
  progress      integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, challenge_id, day)
);

-- Fast "today's progress for this user" lookups.
CREATE INDEX challenge_progress_user_day_idx ON challenge_progress (user_id, day);

-- Challenge completions also award (variable) XP through the same ledger, so
-- widen the reason CHECK to admit them.
ALTER TABLE xp_events DROP CONSTRAINT xp_events_reason_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_reason_check
  CHECK (reason IN ('wave.reciprocated', 'alert.posted', 'trade.completed', 'challenge.completed'));
