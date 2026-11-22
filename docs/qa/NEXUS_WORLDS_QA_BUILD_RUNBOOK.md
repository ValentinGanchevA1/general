# NEXUS Worlds QA APK

## Purpose
Provide a manually triggered, short-retention APK artifact for physical testing of PR #1147. The QA gate is compile-time environment-only and must not be set in production release workflows.

## Current environment gate (read-only verification, 2026-11-22)
- Supabase production project `G88`: ref `hmtwlkplyjbskljntdkl`, PostgreSQL 17.6; `public.schema_migrations` has 85 rows / 85 distinct filenames and the public schema has 66 base tables.
- Supabase project `NEXUS-STAGING`: ref `dvpgvchvackudnjyosag`, PostgreSQL 17.12, ACTIVE_HEALTHY; public schema currently has 0 base tables and no `public.schema_migrations`.
- Render workspace `g88`: `g88-api` is on `master`, auto-deploy is off, URL is the production `g88-api.onrender.com`; no staging API service or Render Postgres instance was listed.
- Therefore the staging DB project exists but has not been bootstrapped, and no staging API host is available/attested. Do not trigger the workflow yet.
- Do not restore production user data into the staging project. Migration provenance/reconciliation and a separate staging API deployment are prerequisite gates.

## Guardrails
- Workflow is manual (`workflow_dispatch`) and does not publish GitHub Releases or tags.
- API host is required as a bare hostname (no scheme, path or port). Production API hostnames and local/loopback hosts are rejected.
- The host check is syntactic only. It cannot validate DNS aliases, CNAME targets, Redis, database, OAuth callbacks, webhooks, cron jobs, FCM or external service isolation. Operator verification is mandatory.
- APK uses the existing Android package and upload signing key, so it can update the installed signed APK without uninstalling; it is not side-by-side. Use test accounts only.
- Artifact retention is five days.
- The QA gate is `NEXUS_WORLDS_QA=1`; normal Release workflow does not set it.
- No backend, database, permissions or production workflow changes are included in this PR.
- QA APK uses dedicated non-production provider credentials; it must not fall back to production Firebase/Maps/MapTiler/Sentry credentials.

## Required GitHub Actions secrets
Configure these on the repository before running the workflow:
- `NEXA_MAPTILER_API_KEY_QA`
- `GOOGLE_MAPS_API_KEY_QA` — restrict to package `com.g88`, the upload signing certificate SHA-1, and only the required Maps APIs.
- `GOOGLE_SERVICES_JSON_QA` — base64-encoded `google-services.json` for a separate Firebase QA project and package `com.g88`.
- Existing Android upload signing secrets: `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`.

Optional:
- `GOOGLE_WEB_CLIENT_ID_QA` — if absent, Google Sign-In is not part of this QA run; use email/password for onboarding validation.
- No Sentry DSN is injected, so QA actions do not send events to the production Sentry project.

## Trigger behavior
- The branch has a push trigger restricted to `feat/nexus-worlds-qa-build-20261122` and only the workflow/config files.
- The job is skipped unless the repository Actions variable `NEXUS_WORLDS_QA_API_HOST` is configured. Set it to a verified non-production bare hostname only after staging is ready.
- GitHub `workflow_dispatch` is also declared, but GitHub only exposes manual dispatch after the workflow file exists on the default branch. Until then, use the gated branch push path. See [GitHub's workflow event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

## Run — only after all infrastructure gates pass
1. Confirm a reachable staging API service whose runtime `DATABASE_URL` targets the isolated project ref `dvpgvchvackudnjyosag`, and whose Redis/integrations are isolated.
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
- This QA APK is a Release-type APK using the production app ID and upload signing identity; it is not a separate installable app.
- Workflow host validation is not a network or infrastructure attestation. Verify the Render service environment privately before running.
- Supabase staging branch/project existence is not proof that migrations, data, or API connectivity are ready.
- Do not use production database credentials, production Firebase config, production Maps key, production MapTiler key, or production Sentry DSN.
- This Draft PR is configuration/code review only until the workflow is run successfully and device evidence is recorded.
