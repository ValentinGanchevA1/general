-- 0045_profile_identity.sql
-- Gender, sexual orientation, nationality for later dating match.
-- Ethnicity deferred. Orientation public visibility defaults OFF.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS gender_self_describe text,
  ADD COLUMN IF NOT EXISTS sexual_orientation text,
  ADD COLUMN IF NOT EXISTS orientation_self_describe text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS show_gender boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_orientation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_nationality boolean NOT NULL DEFAULT true;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_gender_check,
  DROP CONSTRAINT IF EXISTS users_sexual_orientation_check;

ALTER TABLE users
  ADD CONSTRAINT users_gender_check
    CHECK (gender IS NULL OR gender IN (
      'woman', 'man', 'non_binary', 'self_describe'
    )),
  ADD CONSTRAINT users_sexual_orientation_check
    CHECK (sexual_orientation IS NULL OR sexual_orientation IN (
      'straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'queer', 'self_describe'
    ));

COMMENT ON COLUMN users.gender IS 'Optional identity; public only when show_gender';
COMMENT ON COLUMN users.sexual_orientation IS 'Optional; public only when show_orientation (default hidden)';
COMMENT ON COLUMN users.nationality IS 'ISO 3166-1 alpha-2 or short country name; public when show_nationality';
COMMENT ON COLUMN users.show_orientation IS 'Default false — orientation is sensitive';
