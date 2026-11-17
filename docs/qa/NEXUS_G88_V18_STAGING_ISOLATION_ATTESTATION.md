# NEXUS G88 v18 — staging isolation attestation (read-only)

**Decision: NO-GO for staging role tests or production cutover.**
Observed on 2026-11-17 through connected Supabase and Render inventory APIs. This report contains only nonsecret metadata. No cloud resource, database role, grant, password, deployment, or migration was created or changed during this inspection.

## Account/project inventory

Both linked Supabase connections (`g88` and `Supabase`) returned exactly one visible project:

- `G88` — project ref `hmtwlkplyjbskljntdkl`, `eu-west-1`, `ACTIVE_HEALTHY`.

These are two connector views of the **same** project, not independent databases. Neither connected view returned a separately named staging project. This does not rule out projects in unlinked accounts or local Supabase/Docker deployments.

Render workspace `tea-d87btoog4nts73domv40` returned the following with `includePreviews=true`:

| Service | Type | Branch | Auto-deploy | Preview generation | Classification |
| --- | --- | --- | --- | --- | --- |
| `g88-api` | Web | `master` | no | off | Existing production backend |
| `g88-legal` | Static | `master` | yes | off | Static legal site; not backend staging |
| `nexa-web-pr-578` | Web | `feature/nexa-web-client-v1` | yes | off | Web client; not verified as isolated backend staging |

No dedicated staging backend or preview service was returned by this workspace listing. This does not demonstrate that historical preview credentials have been revoked; deleted preview services may have left active secrets in other integrations.

The production `g88-api` build command still includes `pnpm --filter @g88/backend migration:run` and the owner has confirmed its database username is `postgres`. This is **not** a safe staging test target.

## Required isolated staging identity gates

**Before** any staging login or DB role creation:

1. Identify the proposed staging project, its distinct immutable project reference, backend service ID, and database target. Compare **nonsecret** host, port, database and username with production. If any element is shared or target identity is ambiguous, stop. Distinct identifiers alone are insufficient; attest the effective target through an isolated connection.
2. Verify separate scoped staging credentials and environment variables. Never copy production `DATABASE_URL`, signing keys, Redis endpoints, S3 buckets, OAuth, payments, push, email or SMS integrations into staging.
3. Require synthetic test accounts/data. Confirm staging cannot write into production queues, events, object storage, webhooks or notifications.
4. Prove backup/restore in disposable infrastructure. Preserve the production `MIGRATION_HISTORY_DRIFT` fail-closed guard until the 15 historical names are reconciled.
5. Only then provision a restricted staging-only app runtime role with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`. Prove precise table/sequence/function grants with an explicit endpoint-to-SQL matrix.
6. Test Auth, Map/PostGIS, Chat/Socket.IO, Events, Marketplace, negative permission cases and rollback. Keep schema migration execution on a distinct manually controlled privileged identity.
7. Record evidence of passing tests before proposing a separately authorized production cutover. No production credential rotation or Render production build edit is authorized here.

## Evidence state

| Gate | Current state |
| --- | --- |
| Distinct cloud staging Supabase project | **NOT VERIFIED** in connected accounts |
| Distinct Render staging API | **NOT VERIFIED** in visible workspace |
| Staging credential separation | NOT VERIFIED |
| Staging data and side-effect isolation | NOT VERIFIED |
| Staging restricted runtime role | NOT CREATED / NOT TESTED by this audit |
| Staging integration tests | NOT EXECUTED |
| Render production migration/build separation | NOT DONE |
| 15 historical migration names reconciled | NO |
| Production release decision | **NO-GO** |

This diagnostic does not authorize creating a paid cloud service, changing live environment variables, merging this PR or deploying. Local staging may exist but was not inspected by these connected inventory APIs.
