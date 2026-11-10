-- NEXUS P0: read-only schema postconditions for legacy migrations 0051/0054/0069.
-- Verify the SQL editor's database host/name/role against Render g88-api privately.
-- The output is catalog metadata ONLY; no PII, DDL, DML or migration tracker edits.
-- A matching schema is NOT proof of exact historical SQL or safe production deploy.
-- One shared relation catalog avoids drifting/repeated names across audit queries.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT current_database() AS database_name,
       current_user AS database_role,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port,
       current_setting('transaction_read_only') AS read_only;

WITH
  target_schema AS (
    SELECT 'public'::text AS name
  ),
  -- Object names occur once, so the different metadata views cannot drift apart.
  -- columns/constraints/index toggles only affect the diagnostic report.
  target_relations(name, inspect_columns, inspect_constraints, inspect_index, trigger_name) AS (
    VALUES
      ('realtime_room_revocations', true, true, false, NULL::text),
      ('realtime_room_revocations_pending', false, false, true, NULL),
      ('event_attendance_confirmations', true, true, false, NULL),
      ('event_reviews', true, true, false, 'event_review_write'),
      ('event_reviews_page_idx', false, false, true, NULL),
      ('event_review_reports', true, true, false, NULL),
      ('event_review_reports_queue_idx', false, false, true, NULL),
      ('analytics_external_deletion_requests', true, true, false, NULL),
      ('analytics_external_deletion_due_idx', false, false, true, NULL),
      ('analytics_external_deletion_submitted_idx', false, false, true, NULL),
      ('analytics_external_deletion_subject_active_uidx', false, false, true, NULL),
      ('analytics_external_deletion_retention_active_uidx', false, false, true, NULL),
      ('analytics_subjects', false, false, false, 'analytics_subjects_queue_posthog_delete')
  ),
  target_functions(name) AS (
    VALUES ('enforce_event_review_update'), ('queue_posthog_subject_deletion')
  ),
  migration_rows AS (
    SELECT filename, applied_at
    FROM public.schema_migrations
    WHERE filename IN (
      '0051_event_reviews.sql',
      '0052_event_reviews.sql',
      '0054_posthog_deletion_queue.sql',
      '0062_posthog_deletion_queue.sql',
      '0069_realtime_room_revocation_outbox.sql'
    )
  ),
  relation_rows AS (
    SELECT t.name AS object_name,
           to_regclass(format('%I.%I', s.name, t.name))::text AS actual_relation
    FROM target_relations AS t
    CROSS JOIN target_schema AS s
  ),
  column_rows AS (
    SELECT c.table_name, c.ordinal_position, c.column_name, c.data_type,
           c.is_nullable, c.column_default
    FROM information_schema.columns AS c
    JOIN target_relations AS t
      ON t.name = c.table_name AND t.inspect_columns
    CROSS JOIN target_schema AS s
    WHERE c.table_schema = s.name
  ),
  constraint_rows AS (
    SELECT cls.relname AS table_name, con.conname AS constraint_name,
           con.contype AS constraint_type,
           pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint AS con
    JOIN pg_class AS cls ON cls.oid = con.conrelid
    JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
    JOIN target_relations AS t
      ON t.name = cls.relname AND t.inspect_constraints
    CROSS JOIN target_schema AS s
    WHERE ns.nspname = s.name
  ),
  index_rows AS (
    SELECT idx.tablename, idx.indexname, idx.indexdef
    FROM pg_indexes AS idx
    JOIN target_relations AS t
      ON t.name = idx.indexname AND t.inspect_index
    CROSS JOIN target_schema AS s
    WHERE idx.schemaname = s.name
  ),
  trigger_rows AS (
    SELECT cls.relname AS table_name, trg.tgname AS trigger_name,
           trg.tgenabled AS enabled, pg_get_triggerdef(trg.oid, true) AS definition
    FROM pg_trigger AS trg
    JOIN pg_class AS cls ON cls.oid = trg.tgrelid
    JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
    JOIN target_relations AS t
      ON t.name = cls.relname AND t.trigger_name = trg.tgname
    CROSS JOIN target_schema AS s
    WHERE ns.nspname = s.name AND NOT trg.tgisinternal
  ),
  function_rows AS (
    SELECT p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           p.prosecdef AS security_definer
    FROM pg_proc AS p
    JOIN pg_namespace AS ns ON ns.oid = p.pronamespace
    JOIN target_functions AS t ON t.name = p.proname
    CROSS JOIN target_schema AS s
    WHERE ns.nspname = s.name
  ),
  audit_rows AS (
    SELECT 1 AS section_rank, 'migration_history' AS section,
           m.filename AS sort_key, to_jsonb(m) AS metadata
    FROM migration_rows AS m
    UNION ALL
    SELECT 2, 'relations', r.object_name, to_jsonb(r)
    FROM relation_rows AS r
    UNION ALL
    SELECT 3, 'columns',
           c.table_name || '.' || lpad(c.ordinal_position::text, 4, '0'), to_jsonb(c)
    FROM column_rows AS c
    UNION ALL
    SELECT 4, 'constraints', c.table_name || '.' || c.constraint_name, to_jsonb(c)
    FROM constraint_rows AS c
    UNION ALL
    SELECT 5, 'indexes', i.tablename || '.' || i.indexname, to_jsonb(i)
    FROM index_rows AS i
    UNION ALL
    SELECT 6, 'triggers', t.table_name || '.' || t.trigger_name, to_jsonb(t)
    FROM trigger_rows AS t
    UNION ALL
    SELECT 7, 'functions', f.function_name, to_jsonb(f)
    FROM function_rows AS f
  )
SELECT section, jsonb_agg(metadata ORDER BY sort_key ASC) AS metadata
FROM audit_rows
GROUP BY section_rank, section
ORDER BY section_rank ASC;

COMMIT;
-- Seven compact metadata sections, never a migration or replay authorization.
