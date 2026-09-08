-- 0038_user_strikes.sql
-- Soft-gate abuse ladder: accumulate strike weight; stories can require phone
-- or temporary suspension after repeated rate-limit / gate violations.

CREATE TABLE IF NOT EXISTS user_strikes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     text NOT NULL
             CHECK (reason IN (
               'story_rate_limit',
               'story_gate',
               'wave_spam',
               'friend_request_spam'
             )),
  weight     integer NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 10),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_strikes_user_created_idx
  ON user_strikes (user_id, created_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS story_suspended_until timestamptz;

COMMENT ON COLUMN users.story_suspended_until IS
  'When set and in the future, story create is blocked (strike escalation).';
