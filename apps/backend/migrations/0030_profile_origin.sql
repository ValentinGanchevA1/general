-- Profile origin + public visibility for age / hometown.
-- date_of_birth already exists (0012); age is derived server-side.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hometown_city    text,
  ADD COLUMN IF NOT EXISTS hometown_country text,
  ADD COLUMN IF NOT EXISTS show_age         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_hometown    boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN users.hometown_city IS 'Free-text city of origin (optional)';
COMMENT ON COLUMN users.hometown_country IS 'ISO 3166-1 alpha-2 or short country name (optional)';
COMMENT ON COLUMN users.show_age IS 'When true, computed age is exposed on public profile';
COMMENT ON COLUMN users.show_hometown IS 'When true, hometown city/country are exposed on public profile';
