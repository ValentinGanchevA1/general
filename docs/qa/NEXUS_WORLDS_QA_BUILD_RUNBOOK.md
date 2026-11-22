# NEXUS Worlds QA APK

## Purpose
Provide an isolated, short-retention APK artifact for physical testing of the Worlds onboarding experience. The QA gate is compile-time environment-only and must not be set in production release workflows.

## Current environment gate (read-only verification, 2026-11-22)
- Supabase production project `G88`: ref `hmtwlkplyjbskljntdkl`, PostgreSQL 17.6; `public.schema_migrations` has 85 rows / 85 distinct filenames and the public schema has 66 base tables.
- Supabase project `NEXUS-STAGING`: ref `dvpgvchvackudnjyosag`, PostgreSQL 17.12, ACTIVE_HEALTHY; public schema currently has 0 base tables and no `public.schema_migrations`.
- Render workspace `g88`: `g88-api` is on `master`, auto-deploy is off, URL is the production `g88-api.onrender.com`; no staging API service or Render Postgres instance was listed.
- Render workspace `g88` has only one Key Value instance, `g88-redis` (free plan, persistence off); no separate staging Redis exists. Do not reuse the production Redis for QA.
- Therefore the staging DB project exists but has not been bootstrapped, and no staging API host is available/attested. Do not trigger the workflow yet.
- Do not restore production user data into the staging project. A separate staging API and Redis are still required.

## Fresh-database migration bootstrap evidence
- The QA preflight includes `apps/backend/scripts/qa-empty-db-bootstrap.cjs`.
- It refuses remote database targets and only connects to the named localhost disposable CI database `nexa_qa_bootstrap`.
- It invokes the repository's actual `migrate.js` runner against an ephemeral PostgreSQL 17 + PostGIS container, then verifies the migration tracker matches every current `apps/backend/migrations/*.sql` filename and checks core schema objects/extensions.
- This validates a clean bootstrap from the current repository baseline only. It does not copy Production data, restore the 85-name Production tracker, prove Production schema parity, or authorize changing Supabase staging.
- Production G88 currently has 85 applied migration names while this checkout has 70 SQL files. The 15-name historical provenance audit remains separate; do not stamp or replay those names just to create a fresh staging database.
- The next safe staging design is a clean, isolated baseline using a dedicated migration/owner credential and a separate restricted runtime credential, followed by API auth/registration and map/discovery smoke tests. No real-user data is needed for first-run Worlds QA.

## Guardrails
- Workflow has a dedicated branch-only preflight push trigger and a manual dispatch path; it does not publish GitHub Releases or tags.
- API host is required as a bare hostname (no scheme, path or port). Production API hostnames and local/loopback hosts are rejected.
- The host check is syntactic only. It cannot validate DNS aliases, CNAME targets, Redis, database, OAuth callbacks, webhooks, cron jobs, FCM or external service isolation. Operator verification is mandatory.
- QA APK uses applicationId `com.g88.qa`, a separate Android app sandbox, and the repository's non-production debug signing certificate. It installs side-by-side with Production and cannot inherit Production app-private storage/Keychain tokens. Its deep-link scheme is `nexa-qa`, so it does not claim Production `nexa://` links.
- Artifact retention is five days.
- The QA gate is `NEXUS_WORLDS_QA=1`; normal Release workflow does not set it.
- No backend runtime or migration changes, Android permissions or production release workflow changes are included. The backend addition is a disposable localhost-only CI migration smoke test.
- QA APK uses dedicated non-production provider credentials; it must not fall back to production Firebase/Maps/MapTiler/Sentry credentials.

## Fresh-database migration bootstrap evidence (2026-11-22)
- GitHub Actions run #11: [Android Worlds QA APK — disposable PostgreSQL 17 bootstrap](https://github.com/ValentinGanchevA1/general/actions/runs/45013449398).
- The workflow started an ephemeral `postgis/postgis:17-3.7` service on the GitHub-hosted runner. No Supabase or Render database was used by this step.
- The actual repository `apps/backend/scripts/migrate.js` runner applied **70/70** current migration files to that empty disposable database.
- A read-only verification transaction confirmed an exact filename match (70 applied / 70 source files), required core objects (`users`, `events`, `listings`, `conversations`, `messages`, `device_tokens`, `v_discoverable_entity`) and extensions (PostGIS, citext, pgcrypto).
- The bootstrap script refuses any database URL except the named localhost disposable target `nexa_qa_bootstrap`; dedicated tests reject Supabase/Render hosts, wrong DB/user/port and non-PostgreSQL protocols.
- The same run passed Mobile Jest (**138 suites / 733 tests**), lint, typecheck, MapLibre/legal gates and offline DB/provenance checks (**26 subtests, 0 failures**).
- This is evidence that the **current 70-file source-controlled baseline can build a fresh PostgreSQL 17 schema**. It does not prove Production equivalence, apply the 15 historical Production tracker names, populate the actual `NEXUS-STAGING` project, verify the Render runtime credentials, or certify API-level auth/discovery. No Production or Supabase staging state was mutated by the CI job.

## Required GitHub Actions configuration
Configure these on the repository before running the workflow:
- `NEXA_MAPTILER_API_KEY_QA`
- `GOOGLE_MAPS_API_KEY_QA` — restrict to package `com.g88.qa`, the repository debug-keystore SHA-1 printed by the workflow, and only the required Maps APIs.
- `GOOGLE_SERVICES_JSON_QA` — base64-encoded `google-services.json` for a separate Firebase QA project and package `com.g88.qa`.
- No production Android upload-keystore secrets are needed. QA Release falls back to the repository debug keystore; the workflow verifies the APK certificate matches it.

Optional:
- `GOOGLE_WEB_CLIENT_ID_QA` — if absent, Google Sign-In is not part of this QA run; use email/password for onboarding validation. To enable Google Sign-In, the QA Firebase/OAuth Android client must be configured for `com.g88.qa` and the debug-keystore SHA-1.
- No Sentry DSN is injected, so QA actions do not send events to the production Sentry project.

## Trigger behavior
- The branch has a push trigger restricted to `feat/worlds-qa-apk-master-clean-20261122` and only the workflow/config files.
- The job is skipped unless the repository Actions variable `NEXUS_WORLDS_QA_API_HOST` is configured. Set it to a verified non-production bare hostname only after staging is ready.
- The two-device realtime privacy E2E is gated by the same variable, builds the isolated `com.g88.qa` package, and uses only QA Maps/Firebase credentials. It is skipped while the QA host is unset; it must never register synthetic users or messages against the Production API.
- GitHub `workflow_dispatch` is also declared, but GitHub only exposes manual dispatch after the workflow file exists on the default branch. Until then, use the gated branch push path. See [GitHub's workflow event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

## Run — only after all infrastructure gates pass
1. Confirm a reachable staging API service whose runtime `DATABASE_URL` targets the isolated project ref `dvpgvchvackudnjyosag`, and whose Redis/integrations are isolated. A separate staging Redis must be provisioned; never point QA at `g88-redis`.
2. Confirm the staging database has the approved schema/migration baseline. The currently observed project is empty; do not run the app against it yet.
3. Confirm non-production Firebase, Maps and MapTiler credentials are configured as the QA secrets above.
4. Add repository Actions variable `NEXUS_WORLDS_QA_API_HOST` with the verified staging API hostname.
5. Push a change to one of the workflow's watched paths on the dedicated QA branch; the push trigger then runs the QA APK build. After the workflow is on the default branch, it can also be launched manually and a host supplied as input.
6. Download the artifact only after workflow success.
7. Install on Huawei Nova 11 and run the acceptance tests below.

## Device acceptance
- QA-01 Fresh test account registration → profile setup → Worlds selector.
- QA-02 Activate a non-default World → portal → Main.
- QA-03 Force stop/relaunch → preference persists, selector does not recur.
- QA-04 Skip → NEXUS preference/session fallback.
- QA-05 Existing account with no first-run marker → Main.
- QA-06 Switch accounts → no preference/marker leakage.
- QA-07 Reduce Motion.
- QA-08 Light mode fallback and Dark accents.
- QA-09 TalkBack and enlarged font.
- QA-10 storage write/cleanup failure paths (unit tests/debug fixture; don't force destructive device storage actions).

## Caveats
- This QA APK is a Release-type APK using `com.g88.qa` and the repository debug signing key. It is a separate installable app; it cannot update Production and does not share Production app-private tokens/data.
- Workflow host validation is not a network or infrastructure attestation. Verify the Render service environment privately before running.
- Supabase staging branch/project existence is not proof that migrations, data, or API connectivity are ready.
- Do not use production database credentials, production Firebase config, production Maps key, production MapTiler key, or production Sentry DSN.
- This PR is configuration/code review only until the preflight succeeds and device evidence is recorded.
