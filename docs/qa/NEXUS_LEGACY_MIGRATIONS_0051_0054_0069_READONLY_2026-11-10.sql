-- NEXUS P0: read-only schema/postconditions of applied legacy names 0051, 0054, 0069.
-- Verify the SQL editor DB identity against Render g88-api DATABASE_URL privately.
-- Do NOT use a PR preview or copy credentials. This reports schema metadata, not user data.
-- A matching schema does NOT prove that recorded historical migration SQL was identical.
-- This inventory is not authorization to deploy, rerun migrations, or edit the tracker.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Confirm the actual session/transaction context without exposing connection credentials.
SELECT current_database() AS database_name,
       current_user AS database_role,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port,
       current_setting('transaction_read_only') AS read_only;

-- Check recorded legacy/current names. A tracker entry alone does NOT prove SQL contents.
SELECT filename, applied_at
FROM public.schema_migrations
WHERE filename IN (
  '0051_event_reviews.sql',
  '0052_event_reviews.sql',
  '0054_posthog_deletion_queue.sql',
  '0062_posthog_deletion_queue.sql',
  '0069_realtime_room_revocation_outbox.sql'
)
ORDER BY filename ASC;

-- A single explicit object inventory avoids repeating object names in many queries.
-- Flags mean: inspect columns, constraints, index, trigger, function respectively.
-- NULL/ABSENT metadata must be treated as a discrepancy, not permission to create.
-- All output rows are metadata only; no application table rows are queried.
WITH settings AS (
  SELECT 'public'::name AS schema_name
), expected (
  object_name, inspect_columns, inspect_constraints,
  inspect_index, inspect_trigger, inspect_function
) AS (
  VALUES
    ('realtime_room_revocations', true, true, false, false, false),
    ('realtime_room_revocations_pending', false, false, true, false, false),
    ('event_attendance_confirmations', true, true, false, false, false),
    ('event_reviews', true, true, false, false, false),
    ('event_reviews_page_idx', false, false, true, false, false),
    ('event_review_reports', true, true, false, false, false),
    ('event_review_reports_queue_idx', false, false, true, false, false),
    ('analytics_external_deletion_requests', true, true, false, false, false),
    ('analytics_external_deletion_due_idx', false, false, true, false, false),
    ('analytics_external_deletion_submitted_idx', false, false, true, false, false),
    ('analytics_external_deletion_subject_active_uidx', false, false, true, false, false),
    ('analytics_external_deletion_retention_active_uidx', false, false, true, false, false),
    ('analytics_subjects', false, false, false, false, false),
    ('event_review_write', false, false, false, true, false),
    ('analytics_subjects_queue_posthog_delete', false, false, false, true, false),
    ('enforce_event_review_update', false, false, false, false, true),
    ('queue_posthog_subject_deletion', false, false, false, false, true)
), metadata AS (
  -- Relation/index presence, including missing expected objects.
  SELECT 'relation'::text AS category, e.object_name,
         to_regclass(format('%I.%I', s.schema_name, e.object_name))::text AS details
  FROM expected AS e CROSS JOIN settings AS s
  WHERE NOT e.inspect_trigger AND NOT e.inspect_function

  UNION ALL

  -- Exact column types, nullability, defaults and ordinals.
  SELECT 'column', c.table_name || '.' || c.column_name,
         jsonb_build_object(
           'position', c.ordinal_position, 'type', c.data_type,
           'nullable', c.is_nullable, 'default', c.column_default
         )::text
  FROM information_schema.columns AS c
  JOIN expected AS e ON e.object_name = c.table_name AND e.inspect_columns
  CROSS JOIN settings AS s
  WHERE c.table_schema = s.schema_name

  UNION ALL

  -- FK, unique and CHECK constraints.
  SELECT 'constraint', cls.relname || '.' || con.conname,
         pg_get_constraintdef(con.oid, true)
  FROM pg_constraint AS con
  JOIN pg_class AS cls ON cls.oid = con.conrelid
  JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
  JOIN expected AS e ON e.object_name = cls.relname AND e.inspect_constraints
  CROSS JOIN settings AS s
  WHERE ns.nspname = s.schema_name

  UNION ALL

  -- Index definitions, including unique and partial predicates.
  SELECT 'index', idx.indexname, idx.indexdef
  FROM pg_indexes AS idx
  JOIN expected AS e ON e.object_name = idx.indexname AND e.inspect_index
  CROSS JOIN settings AS s
  WHERE idx.schemaname = s.schema_name

  UNION ALL

  -- Trigger definitions and enabled status; never execute the trigger.
  SELECT 'trigger', e.object_name,
         pg_get_triggerdef(trg.oid, true) || ' | enabled=' || trg.tgenabled::text
  FROM expected AS e
  CROSS JOIN settings AS s
  LEFT JOIN pg_trigger AS trg
    ON trg.tgname = e.object_name
    AND NOT trg.tgisinternal
    AND EXISTS (
      SELECT 1
      FROM pg_class AS cls
      JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
      WHERE cls.oid = trg.tgrelid AND ns.nspname = s.schema_name
    )
  WHERE e.inspect_trigger

  UNION ALL

  -- Function signatures and security-definer state only; never invoke the function.
  SELECT 'function', e.object_name,
         'arguments=' || pg_get_function_identity_arguments(p.oid) ||
         ' | security_definer=' || p.prosecdef::text
  FROM expected AS e
  CROSS JOIN settings AS s
  LEFT JOIN pg_proc AS p
    ON p.proname = e.object_name
    AND EXISTS (
      SELECT 1 FROM pg_namespace AS ns
      WHERE ns.oid = p.pronamespace AND ns.nspname = s.schema_name
    )
  WHERE e.inspect_function
)
SELECT category, object_name, COALESCE(details, 'ABSENT') AS details
FROM metadata
ORDER BY category ASC, object_name ASC;

COMMIT;
-- Read-only evidence only. No deploy / replay / migration-history authorization.
