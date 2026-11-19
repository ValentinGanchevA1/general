# NEXUS G88 v18 — Runtime privilege matrix and staging gate

**Decision: production NO-GO.** Diagnostic-only evidence, no production role, grant, password, migration, Render, or deployment changes.

## G88 read-only observations (2026-11-17)

| public object | total | anon | authenticated | service_role |
|---|---:|---:|---:|---:|
| tables: SELECT | 66 | 0 | 0 | 66 |
| views: SELECT | 1 | 0 | 0 | 1 |
| sequences: USAGE | 3 | 0 | 0 | 3 |
| functions: EXECUTE | 52 | 52 | 52 | 52 |

These are effective privilege counts from PostgreSQL catalogs, **not proof of network/Data API exposure**. The 52 executable functions need per-function review of arguments, volatility, privileges, search_path, invoker context and business impact. Earlier v17 checks found zero SECURITY DEFINER functions in public; that does not establish harmlessness.

## Application architecture observed in master

- NestJS TypeOrmModule uses DATABASE_URL with synchronize=false.
- Auth and Chat execute raw SQL via the database abstraction.
- Events uses transactions and raw SQL.
- Map discovery uses SQL and advisory transaction locking.
- Render production build still includes migration:run and production DATABASE_URL uses postgres (owner-confirmed).
- Supabase Data API reachability and frontend usage remain unverified.

## Proposed role matrix (NOT authorized grants)

| Component | Candidate minimum | Must verify in isolated staging |
|---|---|---|
| Auth | SELECT/INSERT/UPDATE on identified auth-owned app tables | Login, refresh, password reset, user creation |
| Map | SELECT on discovery tables and PostGIS function EXECUTE | Viewport, location privacy, geospatial indexes |
| Chat | SELECT/INSERT/UPDATE on conversations/messages/memberships | DM, group membership, receipts, transaction locking |
| Events | SELECT/INSERT/UPDATE on events/RSVP/polls | Join/leave, RSVP, concurrency |
| Marketplace | CRUD only on required listings/offer tables | Listing create/update, offers, access control |
| Migrations | DDL privileged role outside runtime | Dedicated manually approved job only |

Do not apply blanket GRANTs. Do not change ownership. Include sequence USAGE/SELECT only when needed; include functions individually. Test that restricted role cannot CREATE/ALTER/DROP, read unrelated schemas, or bypass RLS.

## Staging validation protocol (not yet executed)

1. Attest dedicated isolated staging host, database, credentials and backup; verify not production. Stop if any identity matches production.
2. Restore schema into disposable database, resolve migration history separately, and create a **staging-only** role with NO SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS.
3. Grant only reviewed schema/table/sequence/function privileges; keep migrations on a separate privileged connection.
4. Execute integration tests for Auth, Map, Chat, Events, Listings, and negative access controls.
5. Record sanitized pass/fail evidence, query errors and rollback; never commit credentials or user data.
6. Production cutover and password rotation require separate explicit approval after staging PASS.

## Blockers

- 15 historical migration names remain unreconciled: MIGRATION_HISTORY_DRIFT.
- Runtime least privilege unproven.
- RPC/function exposure unreviewed.
- Production build still runs migrations.
- Dedicated staging role not created or tested.
- Production credential rotation not authorized.
