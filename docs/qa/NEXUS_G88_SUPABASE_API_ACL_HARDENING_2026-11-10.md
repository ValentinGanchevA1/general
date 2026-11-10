# NEXUS G88 — Supabase Data API role ACL hardening (2026-11-10)

**Status:** Applied and verified in the connected **G88** Supabase project `hmtwlkplyjbskljntdkl`; follow-up API testing and backup verification still required. Scope: PostgreSQL privilege hardening only, not migration reconciliation or a Render deployment.

## Why this is needed

- The linked Supabase project's `public` schema had **66 application tables**: 65 with RLS OFF and no RLS policies. Each of those 65 had unrestricted `anon`/ `authenticated` SELECT/INSERT/UPDATE/DELETE (and other SQL) grants.
- Sensitive relations included the NEXUS users, conversations, messages, refresh-token and member/block data. This grants access **if Supabase Data API exposes `public`**; an actual public data-exposure incident or Data API enabled state has NOT been independently demonstrated.
- Current application source uses a NestJS API backed by PostgreSQL, not direct `supabase.from()` in the mobile/web app. Root dependencies include Supabase libraries, so external/unindexed consumers are not conclusively excluded.
- Official Supabase guidance: https://supabase.com/docs/guides/api/securing-your-api and https://supabase.com/docs/guides/database/postgres/row-level-security . Prefer disabling the Data API in Dashboard if no clients need it, then keep DB-side grants minimal for defense in depth.

## Emergency reversible ACL operations — already executed

The source-controlled operational SQL is `ops/sql/G88_SUPABASE_API_ROLE_ACL_HOTFIX_2026-11-10.sql`. It was executed as **two atomic PostgreSQL DO statements**, using a 1.5-second lock timeout, and verified after completion:
- `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated`
- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated`
- Equivalent revoke for existing `public` sequences and default privileges on future sequences owned by `postgres`.
- Each block checked remaining direct grants and raised an exception (atomic rollback) if security assertions failed.

### Postcondition evidence (live read-only metadata after the change)

| Metric | Before | Verified after |
| --- | ---: | ---: |
| Tables in public | 66 | 66 |
| Public tables with RLS OFF | 65 | 65 (unchanged) |
| Tables readable by `anon` | 65 | **0** |
| Tables insertable/updatable/deletable by `anon` | 65 | **0** |
| Tables readable by `authenticated` | 65 | **0** |
| Tables readable by `postgres` | 66 | **66** |
| Tables readable by `service_role` | 66 | **66** |
| Sequences usable by `anon` or `authenticated` | 3 | **0** |
| Sequences usable by `postgres` or `service_role` | 3 | **3** |
| Default table grants to `anon` / `authenticated` | Present | **0** |
| `public.schema_migrations` rows | 85 | **85** |
| Active app users | 2,440 | **2,440** |

No app user rows, DOB values, profile visibility, auth tokens, schemas or migration tracker were changed by these operations. The pre-change 66-table ACL metadata fingerprint (not a backup) was `c3bfa3f97fd0dda1c50a78f89fd2108c`. A separate, verified backup/restore is still essential for later schema repairs.

## Outstanding security surface and operational caveats

1. **RLS remains disabled for 65 tables.** Direct grants now deny both Data API roles. If they must ever regain access, first add least-privilege RLS policies and test both allowed and denied operations; do not blanket-GRANT.
2. **RPC/function permissions:** 52 `public` functions are executable by `anon` (some via `PUBLIC`); none are `SECURITY DEFINER`. Their code and necessary execute rights need an additional security review before changing them, especially PostGIS functions and triggers.
3. **Data API enablement** is not confirmed by available project metadata. If NEXUS only uses NestJS, owner should disable **Enable Data API** in Supabase Dashboard > Integrations > Data API and validate that `/rest/v1` no longer serves data. Do NOT paste service or publishable keys into GitHub comments.
4. Validate a representative set of actual NestJS API health/auth/map/chat calls after the ACL change, plus any other tools using Supabase REST. Render app error logs queried in a recent window showed no ERROR entries, but absence of logs is NOT an end-to-end success test.
5. **No rollback by blanket GRANT ALL.** If an intentional direct Data API integration breaks, restore only the minimum specific table/operation grants with correct RLS policies, on staging first. Do not restore the dangerous baseline wholesale.
6. Preserve the backend `postgres` account and `service_role` roles, and guard all current/future schema changes. This hotfix does **not** resolve Render `MIGRATION_HISTORY_DRIFT`, the 15 unknown names (#1092), unsafe `users.visibility DEFAULT 'public'` (#1093), or 18+ rollout (#1096).

## Read-only verification query

```sql
SELECT COUNT(*) FILTER (WHERE NOT c.relrowsecurity) AS rls_off,
       COUNT(*) FILTER (WHERE has_table_privilege('anon',c.oid,'SELECT')) AS anon_selectable,
       COUNT(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'SELECT')) AS auth_selectable,
       COUNT(*) FILTER (WHERE has_table_privilege('postgres',c.oid,'SELECT')) AS backend_owner_selectable
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');
```

**Scope:** SQL authorization DCL was applied directly in the linked G88 Supabase project; these actions are not executed automatically by GitHub CI, Render, or this documentation PR.
