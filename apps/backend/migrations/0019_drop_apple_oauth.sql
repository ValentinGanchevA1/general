-- 0019: drop Apple Sign-In support
-- Apple Sign-In (A3) was removed from the project. Reverses 0009_apple_oauth.sql.
-- Safe to run regardless of whether 0009 was applied: IF EXISTS guards both objects.
-- No data loss of concern — Apple OAuth never went live (no working credentials
-- were ever configured), so apple_sub is empty in every environment.
DROP INDEX IF EXISTS users_apple_sub_idx;
ALTER TABLE users DROP COLUMN IF EXISTS apple_sub;
