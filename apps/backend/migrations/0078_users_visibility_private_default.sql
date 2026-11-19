-- RC1 privacy hardening (staging only until migration-history drift is resolved).
-- The base schema's visibility DEFAULT 'public' is unsafe when a new SQL writer
-- omits visibility. Change ONLY the default for new rows.
--
-- This migration intentionally does not change existing visibility values,
-- public opt-in, DOB, account eligibility, or the schema_migrations tracker.
-- Never manually apply to the unverified production database; first restore a
-- verified backup in isolated staging and reconcile 15 history mismatches.
ALTER TABLE public.users ALTER COLUMN visibility SET DEFAULT 'private';
