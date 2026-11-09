# NEXUS Android Two-Device E2E — staging-only release gate

**Status (2026-11-08): CODE HARDENING, NOT A DEVICE QA PASS.** The original PR-triggered Android Two-Device job contained a hardcoded live API URL (`https://g88-api.onrender.com`). Its setup script creates four accounts, updates profiles, opens conversations, sends Socket.IO messages, and the device flow blocks a user. Those are **writes**, not read-only probes. A pre-build HTTP 504 prevented recent runs from reaching that step; this does **not** prove earlier runs never wrote to the live environment.

## Fail-closed behavior

- `.github/workflows/android-two-device-privacy-e2e.yml` no longer supplies the live API as a default.
- The job only runs after an explicitly dispatched **manual workflow run** with `confirm_staging_mutations=I_APPROVE_STAGING_WRITES` AND **both** repository variables configured by an authorized operator. All automatic `pull_request` runs are **SKIPPED**, even after staging is approved:
  - `NEXUS_E2E_STAGING_BASE_URL`: the reviewed **separately hosted** HTTPS staging backend origin, with a staging-only database, Redis and outbound services.
  - `NEXUS_E2E_STAGING_APPROVED`: literal `true` after staging isolation review.
- Without the per-run manual confirmation or either variable, the job is **SKIPPED**, not passed. Do **not** count green aggregate checks or skipped jobs as two-device QA evidence.
- `scripts/android-two-device-privacy-setup.mjs` fails closed before any registration or cleanup if approval or a valid HTTPS staging origin is missing. It explicitly denies `g88-api.onrender.com` (including a trailing-dot hostname). `verify` checks these conditions without making any network request.
- The shell E2E runner calls `verify` before installing/opening the app and no longer contains a live API fallback.
- Probe APK build reuses the same Gradle cache format as the regular Android Build workflow and retries transient remote artifact download failures. This improves resilience but **does not** establish a successful emulator test.

## Required owner/operator evidence before enabling

1. Record the exact staging URL **privately**, and confirm it cannot route via DNS, reverse proxy or CNAME to the live API. The exact-host guard is **not DNS isolation proof**.
2. Prove the staging DB credentials cannot access production data or migrations. Check Redis, S3, OAuth, Socket.IO, push, email, crash reporting and analytics isolation separately.
3. Ensure sandbox email/push, synthetic-only test identities, appropriate staging Terms/age-gate configuration and that the app's test build points at the same approved staging endpoint. Do not send synthetic account messages to real users.
4. Approve the two repository variables above and **manually dispatch** the workflow with the confirmation choice `I_APPROVE_STAGING_WRITES` only after security review. The operator must keep the approval evidence in the PR.
5. Collect job URL, actual emulator boot logs, device UI/realtime event assertions, error reports, candidate commit/SHA and APK metadata.
6. Verify that all synthetic accounts, content, conversations and block records were deleted from staging. Setup now journals each successful registration immediately in a restricted-permission state file, allowing partial-run cleanup; journal creation is exclusive so a new run cannot overwrite old evidence, and subsequent journal updates use atomic file replacement. Cleanup tracks confirmed deletions, treats HTTP 401 or malformed journal content as errors, and fails the workflow rather than silently succeeding. A failed registration response or crash before a journal write can still leave an untracked account. **Do not assume cleanup succeeded.** Reconcile disposable test accounts and associated content read-only before sign-off.
7. Confirm **no production database migrations, account changes, user messages or Play Console writes** occurred.

## Offline guard regression

After `pnpm install --frozen-lockfile`:

```bash
node --test scripts/android-two-device-privacy-setup.test.mjs
```

CI also runs this test in the backend job, independent of staging approval. It checks missing approval, empty/malformed URLs, live API and trailing-dot denial, and approved synthetic staging acceptance without contacting any server.

**Release gate:** neither a skipped staging job nor a failed Gradle/CodeQL dependency download is Android device QA evidence. PR #1066 and #1067 remain Draft; a separate signed release AAB, legally reviewed Terms/Privacy, Social 18+ acceptance, moderation and Google Play decisions are still required.

## RC1 update — probe APK backend parity (9 November 2026)

**New critical finding:** Before this update, `apps/mobile/src/config.ts` compiled every release-mode APK with `https://g88-api.onrender.com` even when synthetic-account scripts targeted staging. The original staging-only job gate was therefore **insufficient**: the installed device app could still authenticate, send messages or share location against the live backend. **Do not run older probe APKs as staging tests.**

- `Config.API_BASE_URL` now selects `NEXA_E2E_API_BASE_URL` **only** when `NEXA_E2E_DEVICE_PROBE=1`. Ordinary release builds continue to select the production API.
- The probe branch rejects missing/non-HTTPS/credential-bearing/URL-path/query addresses and the known production hostname. The workflow supplies `NEXA_E2E_API_BASE_URL` and the setup target `DEVICE_E2E_BASE_URL` from the same approved staging variable.
- A preflight checks both values match exactly before Gradle builds the probe APK.
- `node --test scripts/ci/device-e2e-api-routing.test.mjs` uses the real TypeScript configuration through an offline JavaScript transform to verify normal release defaults, staging probe routing and fail-closed invalid/live target conditions. It is included in Backend CI beside the synthetic-account target guard.
- These guards prevent accidental use of the **known** live URL; they cannot prove a different hostname, DNS alias or proxy isn't backed by production. Staging DB/service/credentials isolation still requires manual operator evidence.

**Status:** static source changes committed in draft branches. Latest-head CI and actual staging emulator execution must be verified before QA sign-off. The new E2E build override is for probe builds only and must never become a user-facing production setting.

## RC1 update — synthetic cleanup integrity (9 November 2026)

The staging setup/cleanup script now keeps a per-user journal before the next pair is created, and attempts deletion only against the matching approved backend. Cleanup errors (including 401) must fail the workflow, preserving the state file for investigation rather than silently claiming success. The offline regression test exercises a partial journal, a denied delete and successful retry. This is **not proof** of deletion in any real backend; operator reconciliation remains required.
