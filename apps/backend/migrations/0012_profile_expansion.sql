-- 0012_profile_expansion.sql — Richer profile surface (G1).
--
-- Adds the columns/tables the redesigned ProfileScreen reads:
--   users.phone            — set in G1, ownership-verified in G2 (Twilio OTP)
--   users.date_of_birth    — age is derived from this server-side, never stored
--   users.subscription_tier— set by Stripe webhook in G3; defaults to 'free'
--   users.interests        — symmetric with the existing goals[] column
--   user_photos            — ordered gallery (avatar_url stays the primary thumb)
--   social_links           — one row per (user, provider); verified flips in G4
--
-- Verification BADGES and verificationScore are NOT stored — they are derived
-- in UsersService from the existing verification_level ladder + premium tier.

ALTER TABLE users
  ADD COLUMN phone             text,
  ADD COLUMN date_of_birth     date,
  ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free'
             CHECK (subscription_tier IN ('free', 'basic', 'premium', 'vip')),
  ADD COLUMN interests         text[] NOT NULL DEFAULT '{}';

CREATE TABLE user_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url         text NOT NULL,
  position    smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- "Gallery for this user, in display order" — the only access pattern.
CREATE INDEX user_photos_user_position_idx ON user_photos (user_id, position);

CREATE TABLE social_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    text NOT NULL
              CHECK (provider IN ('instagram', 'twitter', 'tiktok', 'facebook', 'linkedin', 'spotify')),
  username    text,
  url         text,
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, provider)
);
