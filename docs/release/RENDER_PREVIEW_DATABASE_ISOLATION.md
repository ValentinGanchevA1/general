# NEXUS — Render PR preview database isolation (release safeguard)

**Status: draft hardening, NOT deployed to production.** Refer to [issue #1078](https://github.com/ValentinGanchevA1/general/issues/1078).

## Risk and evidence

Render **service previews copy parent settings**, including database environment
variables, until overridden. NEXUS's Render preview backend services also have
a build command that invokes `pnpm --filter @g88/backend migration:run`.
That combination can accidentally run a feature branch's SQL migrations against
the production database **if a preview inherits production DATABASE_URL**.
We have not been able to inspect the preview secrets, so whether this happened
is unknown. Source: https://render.com/docs/service-previews.

## Fail-closed behavior in this PR

- Both `apps/backend/scripts/migrate.js` and NestJS `src/main.ts` call
  `resolveDatabaseUrl(process.env)` before connecting or bootstrapping.
- When Render reports `IS_PULL_REQUEST=true`, both operations **require**
  `NEXUS_PREVIEW_DATABASE_URL`. No fallback to inherited `DATABASE_URL`.
- The guard rejects a missing/invalid preview URL, or a preview URL pointing to
  the **same hostname/port/database name** as the inherited URL, even if the
  username, password or query flags are different.
- On previews, NestJS uses the dedicated preview DB URL for the entire app.
  The migration runner uses the same explicit preview DB.
- Production (`IS_PULL_REQUEST=false` or unset) keeps its existing
  `DATABASE_URL` behavior unchanged.
- Errors do not print DB credentials or connection strings.

**Important:** Comparing URLs is necessary but not proof of DB isolation.
DNS aliases/connection proxies can conceal the same database. A new database
must be provisioned and ownership/connection isolation validated manually.

## Owner setup before enabling a Render PR preview

1. Create a dedicated **disposable** Postgres database (with its own restricted
   user and credentials); do **not** use live users, identity records or payments.
2. Inspect base/preview `DATABASE_URL` privately in the Render dashboard.
   Confirm the new database is distinct by host/database identity, permissions
   and a read-only schema check. Never post any URL or credentials in GitHub.
3. On each PR preview service, set `NEXUS_PREVIEW_DATABASE_URL` to the
   dedicated DB, then redeploy that preview *only after approval*.
4. Verify migrations apply to preview-only schema, no production migration
   records change, and NestJS boots against the same preview database.
5. Audit Redis, object storage, token signing, email/push, Google OAuth and
   external providers separately. **A separate DB is not complete isolation.**
6. Close/restrict stale preview services if they cannot be isolated safely.

## Acceptance evidence

- `node --test apps/backend/scripts/preview-db-guard.test.cjs` passes in CI.
- No preview DB provided: migration runner and NestJS both fail closed.
- Equal production/preview DB identity: both fail closed.
- Explicitly isolated DB: preview migrations and backend boot against preview,
  with safe, synthetic seeded test accounts only.
- No production deploy, DB migration, Play upload or legal publication
  happens as part of reviewing this draft PR.

Because Render automatically creates service previews for new PRs, **the PR's
preview may intentionally fail to deploy** until an isolated DB is configured.
This is a safety gate, not proof of a broken application.

## Release sign-off evidence checklist (2026-11-08)

**Code CI passed** on PR #1079 head `c0cac62ec28dd13b42ed3c67f6bb658f02d087ae`: CI, ESLint, CodeQL, Semgrep, PostGIS and AWS policy validation. These results **do not demonstrate Render environment isolation**. Keep this PR draft until the evidence below is captured by an operator with Render access.

| Check | Required proof (never expose secrets) | Current status |
| --- | --- | --- |
| Render preview detection | Redacted dashboard/build log showing `IS_PULL_REQUEST=true` for each affected service | UNKNOWN |
| Production separation | Operator-confirmed preview host/cluster, database, **role permissions**, and DNS/connection-proxy identity differ appropriately from production | UNKNOWN |
| Fail-closed execution | Preview deploy with dedicated URL absent fails **before** migration/boot; sanitized logs only | NOT RUN |
| Safe positive test | Disposable preview database, isolated account/role, synthetic data, migration and Nest boot result | NOT RUN |
| Production integrity | Compare production schema-migration count/latest entries before and after preview test via read-only operator query | UNKNOWN |
| Other inherited secrets | Redis, object storage, OAuth, JWT, push/email and third-party service blast-radius review | UNKNOWN |
| Owner authorization | Explicit approval for isolated preview redeploy; no approval implies no deploy | NOT GIVEN |

**Blocking rules:** Do not activate previews merely because code CI is green; do not paste redacted or full DB URLs, tokens, passwords, database dumps or user records in GitHub. A distinct database name on the same host does **not** by itself provide isolation; require an independently permission-scoped role and evidence of the production access boundary. DNS aliases or proxies can defeat hostname comparisons. Keep existing production deployment unchanged. When evidence is obtained, link sanitized proof in the PR and request explicit owner sign-off before any operational change.
