-- 0009: Apple Sign-In support
-- apple_sub is the Apple user identifier (stable per app, per user)
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_apple_sub_idx
    ON users (apple_sub)
 WHERE apple_sub IS NOT NULL;
