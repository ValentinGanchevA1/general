-- 0006_user_goals.sql
-- Adds goals[] to users for the onboarding "What are you here for?" step
-- and the profile card on the map. Default '{}' so existing rows are valid.
ALTER TABLE users ADD COLUMN IF NOT EXISTS goals TEXT[] NOT NULL DEFAULT '{}';
