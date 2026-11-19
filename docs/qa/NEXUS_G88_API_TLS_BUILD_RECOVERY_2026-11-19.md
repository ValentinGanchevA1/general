# g88-api read-only recovery preparation — 2026-11-19

**Status: DRAFT / PRODUCTION NO-GO.** This is a code/configuration proposal, not a live recovery, a migration reconciliation, or authorization to mutate the production database.

## Evidence (Render g88, service g88-api)

- Runtime logs: NestJS/TypeORM retries and exits with `(ESSLREQUIRED) SSL connection is required for user: postgres`.
- Latest deployment builds compile shared TypeScript and NestJS, then fail during the configured `pnpm --filter @g88/backend migration:run` with `MIGRATION_HISTORY_DRIFT` (15 applied names absent from master).
- Render service Build Command is currently configured separately in the Dashboard and still invokes migrations. GitHub code changes **do not** update that service setting.
- Backend Auto Deploy was off when inspected. Do not assume that a draft PR reaches production automatically.
- The migration history guard correctly refuses writes; this patch deliberately does **not** change it, migration SQL, schema tracking, credentials, preview isolation, or production data.

## Proposed code changes

1. `apps/backend/src/config/postgres-ssl.ts` explicitly configures verified TLS for TypeORM in production, strips `sslmode` from the URI **when** it supplies the TLS object (node-postgres otherwise overrides SSL object properties), rejects non-TLS production modes, and accepts an optional PEM CA via `DATABASE_SSL_CA_PEM`. Never disable certificate validation to bypass the failure.
2. `scripts/render/build-backend.sh` installs/builds application artifacts **without any database query or migration**. This is the proposed Render Build Command, **not yet applied**:

   ```bash
   bash scripts/render/build-backend.sh
   ```

3. Existing `apps/backend/scripts/migrate.js`, `migration-history-guard.js` and `preview-db-guard.js` remain intact and fail closed.
4. Regression tests exercise TLS configuration offline and assert the suggested build command does not launch migration tooling.

## Validation and controlled activation

- CI must pass backend Jest, typecheck, lint, build, migration-history safety tests, and the offline render-build contract.
- In Render Environment, compare only **non-secret** host/port/database/user identity with the intended Supabase G88 connection; never paste a URL, password, or PEM into GitHub, logs, or chat. Do not presume prior evidence attests the *current* environment.
- If the TLS chain is not trusted by the runtime, obtain the **current** Supabase database root certificate from its Database SSL Configuration page, store it as a *secret environment variable* named `DATABASE_SSL_CA_PEM` in the intended Render service; it must contain the PEM certificate, not a local Windows path. If using the default trust store, do not set this variable.
- The existing Render Build Command must be changed separately in the Render Dashboard (not by this GitHub PR). **Do not deploy** a build while it still runs `migration:run`; do not delete history rows, add unverified aliases, disable database SSL enforcement, or change the guarded runner.
- Only after owner approval and environment/target attestation, deploy the reviewed code with the migration-free build command and check `GET /health`, read-only DB connectivity, representative auth/map endpoints, and fresh Nest/Render errors. `/health` is a liveness endpoint and does not prove schema compatibility.
- The 15 unresolved historical migration names, production schema provenance, least-privilege database role and staging restore remain **independent NO-GO gates**. Runtime recovery is not a release sign-off.

## Offline tests

```bash
node --test scripts/render/build-backend.test.cjs
pnpm --filter @g88/backend exec jest --ci --runInBand src/config/postgres-ssl.spec.ts
pnpm --filter @g88/backend typecheck
```

**No production connection, migration, deploy, or environment mutation is part of this patch.**
