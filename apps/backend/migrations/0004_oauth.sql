-- 0004: OAuth support
-- password_hash is NULL for OAuth-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Partial unique index allows multiple NULL google_id rows (email/pw users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx
    ON users (google_id)
 WHERE google_id IS NOT NULL;
