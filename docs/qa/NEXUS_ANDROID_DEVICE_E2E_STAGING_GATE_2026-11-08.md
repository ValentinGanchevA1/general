# NEXUS Android Two-Device E2E — staging-only release gate

**Status (2026-11-08): CODE HARDENING, NOT A DEVICE QA PASS.** The original PR-triggered Android Two-Device job contained a hardcoded live API URL (`https://g88-api.onrender.com`). Its setup script creates four accounts, updates profiles, opens conversations, sends Socket.IO messages, and the device flow blocks a user. Those are **writes**, not read-only probes. A pre-build HTTP 504 prevented recent runs from reaching that step; this does **not** prove earlier runs never wrote to the live environment.

## Fail-closed behavior

- `.github/workflows/android-two-device-privacy-e2e.yml` no longer supplies the live API as a default.
- The job only runs when **both** repository variables are configured by an authorized operator:
  - `NEXUS_E2E_STAGING_BASE_URL`: the reviewed **separately hosted** HTTPS staging backend origin, with a staging-only database, Redis and outbound services.
  - `NEXUS_E2E_STAGING_APPROVED`: literal `true` after staging isolation review.
- With either variable absent, the job is **SKIPPED**, not passed. Do **not** count green aggregate checks or skipped jobs as two-device QA evidence.
- `scripts/android-two-device-privacy-setup.mjs` fails closed before any registration or cleanup if approval or a valid HTTPS staging origin is missing. It explicitly denies `g88-api.onrender.com` (including a trailing-dot hostname). `verify` checks these conditions without making any network request.
- The shell E2E runner calls `verify` before installing/opening the app and no longer contains a live API fallback.
- Probe APK build reuses the same Gradle cache format as the regular Android Build workflow and retries transient remote artifact download failures. This improves resilience but **does not** establish a successful emulator test.

## Required owner/operator evidence before enabling

1. Record the exact staging URL **privately**, and confirm it cannot route via DNS, reverse proxy or CNAME to the live API. The exact-host guard is **not DNS isolation proof**.
2. Prove the staging DB credentials cannot access production data or migrations. Check Redis, S3, OAuth, Socket.IO, push, email, crash reporting and analytics isolation separately.
3. Ensure sandbox email/push, synthetic-only test identities, appropriate staging Terms/age-gate configuration and that the app's test build points at the same approved staging endpoint. Do not send synthetic account messages to real users.
4. Approve the two repository variables above and trigger an explicit test run only after security review. The operator must keep the relevant approval evidence in the PR.
5. Collect job URL, actual emulator boot logs, device UI/realtime event assertions, error reports, candidate commit/SHA and APK metadata.
6. Verify that all synthetic accounts, content, conversations and block records were deleted from staging. Setup currently writes its final state only after both conversation pairs are prepared; an intermediate failure can leave accounts without a cleanup-state file. **Do not assume cleanup succeeded.** Confirm via an operator-side, read-only reconciliation before sign-off.
7. Confirm **no production database migrations, account changes, user messages or Play Console writes** occurred.

## Offline guard regression

After `pnpm install --frozen-lockfile`:

```bash
node --test scripts/android-two-device-privacy-setup.test.mjs
```

CI also runs this test in the backend job, independent of staging approval. It checks missing approval, empty/malformed URLs, live API and trailing-dot denial, and approved synthetic staging acceptance without contacting any server.

**Release gate:** neither a skipped staging job nor a failed Gradle/CodeQL dependency download is Android device QA evidence. PR #1066 and #1067 remain Draft; a separate signed release AAB, legally reviewed Terms/Privacy, Social 18+ acceptance, moderation and Google Play decisions are still required.
