-- 0002_profile_fields.sql
-- Adds bio to users.
-- Profile completion = bio IS NOT NULL AND avatar_url IS NOT NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
