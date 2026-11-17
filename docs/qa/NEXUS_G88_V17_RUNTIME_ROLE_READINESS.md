# NEXUS G88 v17 — Runtime role readiness (diagnostic only)

**Decision: production NO-GO.** The G88 owner confirmed Render `g88-api` uses database username `postgres`. The Render production build still calls `pnpm --filter @g88/backend migration:run`. Do not rotate passwords, change grants/roles, resume previews or deploy as part of this PR.

## Read-only baseline observed 2026-11-17

On G88 Supabase, a catalog-only query across ordinary/partitioned `public` tables returned 66 tables, 1 with RLS enabled, 65 without RLS, all 66 owned by `postgres`. Effective grants by table, aggregated:

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| anon | 0 | 0 | 0 | 0 |
| authenticated | 0 | 0 | 0 | 0 |
| postgres | 66 | 66 | 66 | 66 |
| service_role | 66 | 66 | 66 | 66 |

This is NOT evidence of public table exposure: both `anon` and `authenticated` had zero table grants in this snapshot. Nor is it proof of complete access isolation: function, view, sequence, schema and service APIs are NOT fully assessed. Do not enable RLS globally without compatibility testing.

## Contents

- `docs/qa/NEXUS_G88_V17_RUNTIME_PRIVILEGE_INVENTORY.sql`: SELECT-only aggregate catalog query; no application rows or credentials.
- `apps/backend/scripts/fixtures/v17-redacted-privilege-snapshot.json`: aggregated, nonsecret observation.
- `apps/backend/scripts/migration-v17-runtime-role-readiness.cjs`: offline, deliberately NO-GO classifier.
- `apps/backend/scripts/migration-v17-runtime-role-readiness.test.cjs`: negative tests, CLI exit code 2, and catalog query safety check.

Run from repository root: `node --test apps/backend/scripts/migration-v17-runtime-role-readiness.test.cjs`.

The CLI `node apps/backend/scripts/migration-v17-runtime-role-readiness.cjs` returns **exit code 2 intentionally**; never use it as production deployment authorization. This package performs no database connections, SQL writes or Render changes.

## Mandatory gates before new runtime credentials

1. Enumerate all PostgreSQL object grants, including functions, sequences, views, `auth`/`storage` dependencies and Data API exposure. Attribute each privilege to a concrete NestJS endpoint/job.
2. Build a **separate staging Supabase project** and provision restricted runtime identity there first. Verify PostGIS, auth, messaging, events, listings and Socket.IO under this identity. Never test this with production credentials.
3. Split runtime `DATABASE_URL` from a privileged, explicitly approved migration workflow **before** switching the production runtime identity. Keep current migration history guard fail-closed; its 15 historical names remain unresolved.
4. Identify every remaining service using the `postgres` credential, including deleted preview deployments and out-of-band connections. Inventory secrets without printing values.
5. Prepare approved rollback, health checks, backup recovery proof and a coordinated secret rotation. Prior connection strings must not remain as persistent fallback.

**No merge or deployment authorization.** Additional owner approval is mandatory for production roles, grants, Render configuration and credential rotation.
