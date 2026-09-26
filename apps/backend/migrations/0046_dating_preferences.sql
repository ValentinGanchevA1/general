-- 0046_dating_preferences.sql
-- Dating map filter: opt-in + seeking genders (identity still optional).
-- Orientation mutuality deferred to soft rank later.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS open_to_dating boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seeking_genders text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN users.open_to_dating IS 'When true, user may appear on Dating map filter and use datingOnly discovery';
COMMENT ON COLUMN users.seeking_genders IS 'Empty = any gender. Values from Gender enum (woman/man/non_binary/self_describe)';

-- Partial index for dating discovery filter
CREATE INDEX IF NOT EXISTS users_open_to_dating_partial_idx
  ON users (id)
  WHERE open_to_dating = true AND deleted_at IS NULL AND visibility = 'public';
