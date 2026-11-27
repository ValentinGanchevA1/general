-- NEXUS G88 v18: read-only aggregate only; no secrets or application rows.
-- Counts represent effective privileges, not confirmed API exposure.
WITH tbl AS (
 SELECT c.oid, c.relkind FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
), roles AS (
 SELECT unnest(ARRAY['anon','authenticated','service_role']) AS role_name
)
SELECT role_name,
 count(*) FILTER (WHERE relkind IN ('r','p')) AS tables,
 count(*) FILTER (WHERE relkind IN ('v','m')) AS views,
 count(*) FILTER (WHERE relkind IN ('r','p') AND has_table_privilege(role_name,oid,'SELECT')) AS tables_select,
 count(*) FILTER (WHERE relkind IN ('v','m') AND has_table_privilege(role_name,oid,'SELECT')) AS views_select
FROM roles CROSS JOIN tbl GROUP BY role_name ORDER BY role_name;

WITH seq AS (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='S'
), roles AS (
 SELECT unnest(ARRAY['anon','authenticated','service_role']) AS role_name
)
SELECT role_name,count(*) AS sequences,
 count(*) FILTER (WHERE has_sequence_privilege(role_name,oid,'USAGE')) AS usage_count
FROM roles CROSS JOIN seq GROUP BY role_name ORDER BY role_name;

WITH funcs AS (
 SELECT p.oid,p.prosecdef FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
), roles AS (
 SELECT unnest(ARRAY['anon','authenticated','service_role']) AS role_name
)
SELECT role_name,count(*) AS functions,
 count(*) FILTER (WHERE prosecdef) AS security_definer_count,
 count(*) FILTER (WHERE has_function_privilege(role_name,oid,'EXECUTE')) AS executable_count
FROM roles CROSS JOIN funcs GROUP BY role_name ORDER BY role_name;
