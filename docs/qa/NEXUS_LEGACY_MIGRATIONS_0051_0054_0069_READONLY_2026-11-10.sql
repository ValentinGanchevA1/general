-- NEXUS P0: read-only schema/postconditions of applied legacy names 0051, 0054, 0069.
-- No migration writes, history reconciliation, DDL, PII, or arbitrary function execution.
-- IMPORTANT: verify this SQL editor's DB identity against Render g88-api DATABASE_URL
-- privately BEFORE running. 'postgres' database/user alone is not identity proof.
-- Use a least-privilege read-only role where possible. Do NOT use a PR preview.
-- A matching schema is NOT proof that the recorded historical SQL source is identical.
-- Do not treat this inventory as authorization for deploy or manual tracker edits.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- 1. Confirm this transaction is actually read-only; never share credentials.
SELECT current_database() AS database_name,
       current_user AS database_role,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port,
       current_setting('transaction_read_only') AS read_only;

-- 2. Only migration filenames + timestamps, not application/user records.
-- Expected owner snapshot: all six names below, including both successor names.
SELECT filename, applied_at
FROM public.schema_migrations
WHERE filename IN (
  '0051_event_reviews.sql',
  '0052_event_reviews.sql',
  '0054_posthog_deletion_queue.sql',
  '0062_posthog_deletion_queue.sql',
  '0069_realtime_room_revocation_outbox.sql'
)
ORDER BY filename;

-- 3. Relation/index presence. NULL means missing or not visible, NOT safe to recreate.
SELECT object_name, to_regclass('public.' || object_name)::text AS actual_relation
FROM (VALUES
  ('realtime_room_revocations'),
  ('realtime_room_revocations_pending'),
  ('event_attendance_confirmations'),
  ('event_reviews'),
  ('event_reviews_page_idx'),
  ('event_review_reports'),
  ('event_review_reports_queue_idx'),
  ('analytics_external_deletion_requests'),
  ('analytics_external_deletion_due_idx'),
  ('analytics_external_deletion_submitted_idx'),
  ('analytics_external_deletion_subject_active_uidx'),
  ('analytics_external_deletion_retention_active_uidx'),
  ('analytics_subjects')
) AS expected(object_name)
ORDER BY object_name;

-- 4. Column contract; check names, types, nullability and defaults.
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'realtime_room_revocations',
    'event_attendance_confirmations',
    'event_reviews',
    'event_review_reports',
    'analytics_external_deletion_requests'
  )
ORDER BY table_name, ordinal_position;

-- 5. Definitions for FK/unique/check constraints, to compare against SQL source.
SELECT cls.relname AS table_name, con.conname AS constraint_name,
       con.contype AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS cls ON cls.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN (
    'realtime_room_revocations',
    'event_attendance_confirmations',
    'event_reviews',
    'event_review_reports',
    'analytics_external_deletion_requests'
  )
ORDER BY cls.relname, con.conname;

-- 6. Index definitions incl. predicates and uniqueness, not just presence.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'realtime_room_revocations_pending',
    'event_reviews_page_idx',
    'event_review_reports_queue_idx',
    'analytics_external_deletion_due_idx',
    'analytics_external_deletion_submitted_idx',
    'analytics_external_deletion_subject_active_uidx',
    'analytics_external_deletion_retention_active_uidx'
  )
ORDER BY tablename, indexname;

-- 7. Metadata for the review and PostHog deletion triggers.
-- This does not invoke functions or inspect/decrypt application data.
SELECT cls.relname AS table_name, trg.tgname AS trigger_name,
       trg.tgenabled AS enabled, pg_get_triggerdef(trg.oid, true) AS definition
FROM pg_trigger AS trg
JOIN pg_class AS cls ON cls.oid = trg.tgrelid
JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND NOT trg.tgisinternal
  AND (
    (cls.relname = 'event_reviews' AND trg.tgname = 'event_review_write')
    OR (cls.relname = 'analytics_subjects' AND
        trg.tgname = 'analytics_subjects_queue_posthog_delete')
  )
ORDER BY cls.relname, trg.tgname;

-- 8. Function signatures only. Never run functions during this audit.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc AS p
JOIN pg_namespace AS ns ON ns.oid = p.pronamespace
WHERE ns.nspname = 'public'
  AND p.proname IN (
    'enforce_event_review_update',
    'queue_posthog_subject_deletion'
  )
ORDER BY p.proname;

COMMIT;
-- Outcome is an inventory only. No inference about actual deploy/DB lineage.
