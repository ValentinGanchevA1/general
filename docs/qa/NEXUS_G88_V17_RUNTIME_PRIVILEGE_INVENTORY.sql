-- NEXUS G88 v17. Catalog-only aggregate; no row data, DDL, passwords or connection strings.
-- Effective table privileges are NOT proof of actual Data API exposure.
WITH tbl AS (
  SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity,
         pg_get_userbyid(c.relowner) AS owner
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
), roles AS (
  SELECT unnest(ARRAY['anon','authenticated','service_role','postgres']) AS role_name
)
SELECT role_name,
       count(*) AS public_tables,
       count(*) FILTER (WHERE relrowsecurity) AS rls_enabled,
       count(*) FILTER (WHERE relforcerowsecurity) AS rls_forced,
       count(*) FILTER (WHERE owner = 'postgres') AS owned_by_postgres,
       count(*) FILTER (WHERE has_table_privilege(role_name,oid,'SELECT')) AS select_tables,
       count(*) FILTER (WHERE has_table_privilege(role_name,oid,'INSERT')) AS insert_tables,
       count(*) FILTER (WHERE has_table_privilege(role_name,oid,'UPDATE')) AS update_tables,
       count(*) FILTER (WHERE has_table_privilege(role_name,oid,'DELETE')) AS delete_tables
FROM roles CROSS JOIN tbl
GROUP BY role_name ORDER BY role_name;
