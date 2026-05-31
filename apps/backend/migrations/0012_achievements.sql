-- 0012_achievements.sql — achievement unlocks + leaderboard indexes.
--
-- Achievement *definitions* live in code (@g88/shared, like the challenge
-- catalog). This table records only the first-time unlock per (user, achievement).
-- Progress toward locked achievements is derived on read from user_gamification
-- (level/streak) and xp_events (per-reason counts) — no progress column to sync.

CREATE TABLE user_achievements (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,                 -- matches a code-side def key
  unlocked_value integer,                        -- metric snapshot at unlock (display)
  unlocked_at    timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, achievement_id)          -- one unlock per achievement, idempotent
);

-- Profile grid: "this user's unlocks, newest first".
CREATE INDEX user_achievements_user_idx
    ON user_achievements (user_id, unlocked_at DESC);

-- Achievement unlocks pay bonus XP through the same ledger → widen the reason
-- CHECK (same pattern as 0011 adding 'challenge.completed').
ALTER TABLE xp_events DROP CONSTRAINT xp_events_reason_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_reason_check
  CHECK (reason IN ('wave.reciprocated', 'alert.posted', 'trade.completed',
                    'challenge.completed', 'achievement.unlocked'));

-- ─── Leaderboard support ────────────────────────────────────────────────────
-- All-time: rank by the denormalized total_xp summary.
CREATE INDEX user_gamification_total_xp_idx
    ON user_gamification (total_xp DESC);

-- Weekly: time-windowed SUM(amount) GROUP BY user_id. The existing
-- (user_id, reason, created_at) index is user-leading and useless for a global
-- window scan; this one leads with created_at and covers the aggregate.
CREATE INDEX xp_events_created_idx
    ON xp_events (created_at) INCLUDE (user_id, amount);
