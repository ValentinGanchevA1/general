-- G88 Supabase defense in depth: owner-only, idempotent operational ACL hotfix.
-- Applied interactively through the linked G88 Supabase SQL action on 2026-11-10.
-- This is NOT an app migration and MUST NOT be invoked by Render build/migration:run.
-- PostgreSQL rows, RLS flags, function privileges, and schema_migrations are untouched.
-- WARNING: Revoke anon/authenticated access only if app access is through NestJS;
-- identify any direct Supabase Data API consumers before rolling out elsewhere.
--
-- Expected precondition: public tables owned by postgres. The app's direct
-- postgres and Supabase service_role privileges remain unchanged.
-- All changes in each DO block are atomic: exceptions roll them back.

DO $g88_table_acl_hardening$
DECLARE remaining_table_grants integer; remaining_default_grants integer;
BEGIN
  PERFORM set_config('lock_timeout', '1500ms', true);
  EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated';

  SELECT COUNT(*) INTO remaining_table_grants
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(
    COALESCE(c.relacl, acldefault('r', c.relowner))
  ) AS acl
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    AND acl.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid);

  SELECT COUNT(*) INTO remaining_default_grants
  FROM pg_default_acl AS d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) AS acl
  WHERE d.defaclrole = 'postgres'::regrole::oid
    AND d.defaclnamespace = 'public'::regnamespace::oid
    AND d.defaclobjtype = 'r'
    AND acl.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid);

  IF remaining_table_grants <> 0 OR remaining_default_grants <> 0 THEN
    RAISE EXCEPTION 'Supabase table ACL postcondition failed; rolling back';
  END IF;
END;
$g88_table_acl_hardening$;

DO $g88_sequence_acl_hardening$
DECLARE remaining_sequence_grants integer;
BEGIN
  PERFORM set_config('lock_timeout', '1500ms', true);
  EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated';

  SELECT COUNT(*) INTO remaining_sequence_grants
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(
    COALESCE(c.relacl, acldefault('S', c.relowner))
  ) AS acl
  WHERE n.nspname = 'public' AND c.relkind = 'S'
    AND acl.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid);

  IF remaining_sequence_grants <> 0 THEN
    RAISE EXCEPTION 'Supabase sequence ACL postcondition failed; rolling back';
  END IF;
END;
$g88_sequence_acl_hardening$;

-- The companion read-only audit and documented production evidence are in:
-- docs/qa/NEXUS_G88_SUPABASE_API_ACL_HARDENING_2026-11-10.md
-- Do NOT auto-GRANT ALL privileges as rollback; restore only reviewed ACLs.
