-- 0053_profile_occupation.sql
-- Optional occupation shown on profiles only when the owner allows it.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS show_occupation boolean NOT NULL DEFAULT true;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_occupation_length_check;

ALTER TABLE users
  ADD CONSTRAINT users_occupation_length_check
  CHECK (occupation IS NULL OR char_length(occupation) <= 80);

COMMENT ON COLUMN users.occupation IS 'Optional free-text occupation/title; max 80 characters';
COMMENT ON COLUMN users.show_occupation IS 'Whether occupation may be exposed on the public profile';
