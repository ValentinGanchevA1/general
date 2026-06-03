-- 0018_gifts.sql — XP-funded gifts (no real money, v1).
--
-- XP now has two faces:
--   total_xp      lifetime score; drives level + leaderboard; NEVER spent.
--   spendable_xp  wallet; earning funds it 1:1 (see GamificationService.awardRaw),
--                 sending a gift spends it.
-- Sending a gift also rewards the recipient a small, daily-capped 'gift.received'
-- XP award (see shared/gamification.ts XP_AMOUNTS / XP_DAILY_CAP).

-- 1. Spendable wallet, decoupled from the lifetime score.
ALTER TABLE user_gamification
  ADD COLUMN IF NOT EXISTS spendable_xp integer NOT NULL DEFAULT 0
    CHECK (spendable_xp >= 0);

-- Existing users' already-earned XP becomes their opening wallet balance.
UPDATE user_gamification
   SET spendable_xp = total_xp
 WHERE spendable_xp = 0 AND total_xp > 0;

-- 2. Allow the recipient-reward reason in the XP ledger (append to the existing set).
ALTER TABLE xp_events DROP CONSTRAINT IF EXISTS xp_events_reason_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_reason_check
  CHECK (reason IN (
    'wave.reciprocated', 'alert.posted', 'trade.completed',
    'challenge.completed', 'achievement.unlocked', 'gift.received'
  ));

-- 3. Fixed gift catalog (seeded; client reads it via GET /gifts/catalog).
CREATE TABLE IF NOT EXISTS gift_catalog (
  id       text PRIMARY KEY,            -- 'rose', 'coffee', 'trophy'
  label    text NOT NULL,
  emoji    text NOT NULL,
  cost_xp  integer NOT NULL CHECK (cost_xp > 0),
  active   boolean NOT NULL DEFAULT true,
  sort     integer NOT NULL DEFAULT 0
);

INSERT INTO gift_catalog (id, label, emoji, cost_xp, sort) VALUES
  ('rose',    'Rose',    '🌹', 10,  1),
  ('coffee',  'Coffee',  '☕', 20,  2),
  ('beer',    'Beer',    '🍺', 25,  3),
  ('pizza',   'Pizza',   '🍕', 40,  4),
  ('diamond', 'Diamond', '💎', 75,  5),
  ('trophy',  'Trophy',  '🏆', 100, 6)
ON CONFLICT (id) DO NOTHING;

-- 4. Append-only record of every send; also the recipient's inbox.
CREATE TABLE IF NOT EXISTS gifts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_id      text NOT NULL REFERENCES gift_catalog(id),
  cost_xp      integer NOT NULL CHECK (cost_xp > 0),  -- price snapshot at send time
  message      text CHECK (message IS NULL OR char_length(message) <= 200),
  seen_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  CHECK (sender_id <> recipient_id)                   -- no self-gifting
);

CREATE INDEX IF NOT EXISTS gifts_recipient_idx ON gifts (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gifts_sender_idx    ON gifts (sender_id, created_at DESC);
