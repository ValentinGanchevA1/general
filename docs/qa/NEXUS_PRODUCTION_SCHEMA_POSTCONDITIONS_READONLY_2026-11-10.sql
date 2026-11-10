-- NEXUS P0: production schema postcondition inventory, read-only.
-- This is NOT a migration or a remediation script.
-- 1) Independently verify the target database identity and SELECT privileges.
-- 2) Execute in production Supabase SQL Editor, never via a Render build.
-- 3) Share only aggregate/metadata output. Never export individual users, DOB,
--    email, phone, IDs, profiles, messages, tokens, or connection strings.
-- 4) Do not interpret matching schema objects as proof of exact deployed SQL.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- A. Identity / read-only confirmation; no connection string or credentials.
SELECT current_database() AS database_name,
       current_user AS database_role,
       current_setting('transaction_read_only') AS read_only;

-- B. Full historic 0072–0077 inventory; expected historical row count: 9.
--    If names/timestamps differ, mark DRIFT; do not rename or delete any rows.
SELECT filename, applied_at
FROM public.schema_migrations
WHERE filename ~ '^007[2-7]_'
ORDER BY applied_at, filename;

-- C. Named schema objects created by the seven distinct historical SQL bodies.
--    NULL means absent/inaccessible, NOT permission to replay a migration.
SELECT object_name,
       to_regclass('public.' || object_name)::text AS actual_relation
FROM (VALUES
  ('user_terms_acceptances'),
  ('personal_labels'),
  ('user_personal_labels'),
  ('personal_label_proposals'),
  ('personal_labels_bg_unique'),
  ('personal_labels_en_unique'),
  ('user_personal_labels_key_idx'),
  ('personal_label_proposals_pending_unique'),
  ('personal_label_proposals_queue_idx'),
  ('personal_label_proposals_user_idx'),
  ('event_questions_visible_event_idx'),
  ('dating_matches_conversation_id_idx'),
  ('content_abuse_reports_priority_queue_idx')
) AS objects(object_name)
ORDER BY object_name;

-- D. Exact CHECK constraint definitions; inspect, do not simply count them.
SELECT t.relname AS table_name,
       c.conname AS constraint_name,
       pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint AS c
JOIN pg_class AS t ON t.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND (
       (t.relname = 'content_abuse_reports'
        AND c.conname IN (
          'content_abuse_reports_target_type_check',
          'content_abuse_reports_reason_check'
        ))
    OR (t.relname = 'user_terms_acceptances'
        AND c.conname IN ('user_terms_version_format'))
  )
ORDER BY table_name, constraint_name;

-- E. Column contracts, including unsafe legacy visibility DEFAULT public.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
       (table_name = 'event_questions' AND column_name = 'deleted_at')
    OR (table_name = 'users' AND column_name IN (
      'date_of_birth', 'visibility', 'open_to_dating'
    ))
  )
ORDER BY table_name, column_name;

-- F. Index definitions, including expected partial predicates.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'event_questions_visible_event_idx',
    'dating_matches_conversation_id_idx',
    'content_abuse_reports_priority_queue_idx',
    'personal_labels_bg_unique',
    'personal_labels_en_unique',
    'personal_label_proposals_pending_unique'
  )
ORDER BY tablename, indexname;

-- G. Privacy invariant aggregates ONLY; no per-user fields/records exported.
--    Treat any missing-DOB public account as a privacy defect, not a fix script.
--    DOB is self-declared: "adult" does NOT mean ID-verified.
SELECT COUNT(*)::bigint AS active_accounts,
       COUNT(*) FILTER (
         WHERE date_of_birth IS NULL
       )::bigint AS missing_dob,
       COUNT(*) FILTER (
         WHERE date_of_birth IS NULL AND visibility <> 'private'
       )::bigint AS missing_dob_not_private,
       COUNT(*) FILTER (
         WHERE date_of_birth > (timezone('UTC', NOW())::date - INTERVAL '18 years')::date
           AND visibility <> 'private'
       )::bigint AS declared_underage_not_private,
       COUNT(*) FILTER (
         WHERE (date_of_birth IS NULL
            OR date_of_birth > (timezone('UTC', NOW())::date - INTERVAL '18 years')::date)
           AND open_to_dating IS TRUE
       )::bigint AS ineligible_dating_enabled,
       COUNT(*) FILTER (
         WHERE visibility = 'public'
       )::bigint AS active_public_accounts
FROM public.users
WHERE deleted_at IS NULL;

COMMIT;

-- Do not run UPDATE, DELETE, INSERT, ALTER, migration:run, or manual
-- tracker reconciliation on production based only on this read-only report.
