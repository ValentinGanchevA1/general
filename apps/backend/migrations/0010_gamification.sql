-- 0010_gamification.sql — XP, levels, and daily streaks.
--
-- Two tables:
--   xp_events          append-only ledger; source of truth for every XP award.
--   user_gamification  denormalized per-user summary for O(1) reads.
--
-- Level is derived from total_xp by formula (cumulative XP to reach level L =
-- 50 * (L-1)^2), stored on the summary row so the client never recomputes.

CREATE TABLE xp_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      text NOT NULL
              CHECK (reason IN ('wave.reciprocated', 'alert.posted', 'trade.completed')),
  amount      integer NOT NULL CHECK (amount > 0),

  -- Idempotency: a given source event (a match, an alert) awards XP at most once
  -- per user. NULL when no natural dedupe key exists.
  dedupe_key  text,

  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- One award per (user, source event). Partial so multiple NULL keys are allowed.
CREATE UNIQUE INDEX xp_events_dedupe_idx
    ON xp_events (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Daily-cap counting: "how many alert.posted awards has this user had today?"
CREATE INDEX xp_events_user_reason_created_idx
    ON xp_events (user_id, reason, created_at DESC);

CREATE TABLE user_gamification (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp       integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level          integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_date date,
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
