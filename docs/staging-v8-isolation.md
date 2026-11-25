# NEXUS v8 — staging isolation gate (draft, no deployment authorization)

## Current evidence
- The inspected Render workspace has `g88-api` on `master` with auto-deploy off. Its build includes `pnpm --filter @g88/backend migration:run`. **Do not trigger it** for staging.
- The public `nexus-many-worlds-demo` runs with `PUBLIC_DEMO_ONLY=1`, denying API/Socket.IO proxy access. It is a presentation environment, **not** an isolated backend.
- No separate staging API service and database were confirmed by this review.
- Existing `preview-db-guard.js` protects Render PR previews only when `IS_PULL_REQUEST=true`; it cannot establish a new staging environment by itself.

## Gate 0 — offline, read-only comparison

Run locally with environment variables set privately:
```sh
node apps/backend/scripts/staging-isolation-preflight.cjs
```
The script compares four explicitly provided references: `DATABASE_URL`, `NEXUS_STAGING_DATABASE_URL`, `REDIS_URL`, `NEXUS_STAGING_REDIS_URL`. It outputs checks and a short staging fingerprint without hostnames, usernames, passwords or URLs. It always exits **2**. Even a green offline comparison is **not** deployment authorization.

Regression tests (no DB/Redis network):
```sh
node --test apps/backend/scripts/staging-isolation-preflight.test.cjs
```

## Gate 1 — independently prove environment separation

1. Provision a dedicated staging Postgres/PostGIS instance or isolated, disposable local Docker instance, with its own DB role, network access policy, credentials and backups disabled/anonymized as appropriate.
2. Provision dedicated staging Redis with no shared host or logical DB reuse.
3. Confirm the production and staging provider project IDs/instance IDs, endpoint IPs and DNS chains **out of band**, not only the URL strings.
4. Verify separate auth and JWT signing credentials, CORS allowlist, OAuth redirect URIs, webhook secrets, provider accounts and S3/media buckets. Use sandbox keys. Disable sending emails, SMS, payments, push and identity-provider checks unless the services have a supported test mode.
5. Ensure no production user records, GPS history, communications, tokens or ID images are copied. Seed synthetic test identities only.
6. Record a reviewer sign-off and evidence IDs without leaking secrets; test a forbidden staging-to-production connection.
7. Require backup/restore validation on the disposable target and independent migration-history check before any SQL changes.

## Gate 2 — staging runtime (future change; not implemented here)

- Dedicated Render service on a pinned staging branch with **auto-deploy off**.
- Build compiles only; never auto-runs migrations. Migration action must be separately authorized, run against a verified staging target and review migration drift first.
- Add a **runtime** staging identity guard beyond `IS_PULL_REQUEST` and enforce environment-specific API audience/auth secrets before allowing network traffic.
- Dedicated Web preview origin and allowlisted staging API origin (only after Gate 1 passes). Keep the public demo in `PUBLIC_DEMO_ONLY=1` until then.
- Test two synthetic accounts: HTTP login, map discovery, Wave request, Socket.IO handshake and chat delivery/ack; throttle and abuse-limit tests included.

## Current decision

**BLOCKED FOR LIVE STAGING CONNECTION.** This document and the preflight checker only prepare review evidence. They neither deploy infrastructure nor grant permission for migrations or production changes.
