# NEXUS Child Safety — reporting QA evidence plan (19 Nov 2026)

**Status: SOURCE-REVIEWED / RUNTIME NOT VERIFIED / NO-GO FOR SELF-CERTIFICATION.**
**Scope:** First-release NEXUS Social 18+, Dating OFF. This document is not legal sign-off and does not authorize production mutations.

## Grounded source findings (GitHub master at commit 7394aae2)

- `docs/PLAY_PRIVACY_REPORTING_RC1.md` describes mobile report UI → Redux `submitContentReport` → authenticated `POST /api/v1/reports`.
- `apps/backend/migrations/0070_content_abuse_reports.sql` defines `content_abuse_reports`; source presence is not proof the deployed database matches.
- `apps/backend/src/modules/content-reports/content-reports.service.ts` inserts reports, with duplicate handling described in the RC1 documentation.
- Admin endpoints documented: `GET /api/v1/admin/content-reports?status=open&offset=0&limit=20` and `POST /api/v1/admin/content-reports/:id/decide` (review, dismiss, hide_story), protected by JWT/AdminGuard.
- `hide_story` soft-deletes stories; existing client caches and media copies may remain. User-report review does **not** suspend an account. There is no claim of automatic chat moderation or immediate media purge.
- `docs/qa/NEXUS_CHILD_SAFETY_RELEASE_GATE_2026-11-08.md` remains NO-GO until production/device evidence, legal review and operational incident handling.

## Owner/contact evidence

- [x] Owner personally accepted role: Valentin Ganchev, NEXUS Owner & Child Safety Contact.
- [x] Owner attested access to and regular review of Google Play developer-account mailbox.
- [ ] Confirm exact Play mailbox address and deliver a real test email; record receipt time (do not paste sensitive message contents into issues).
- [ ] Identify authorized alternate responder and escalation when owner unavailable, or explicitly document lack of backup.
- [ ] Legal/safety reviewer signs off on Bulgaria/EU incident escalation, reporting obligations, data minimization, lawful evidence preservation and removal.

## Runtime acceptance test matrix (DO NOT run against production without controlled approval)

| ID | Test | Required evidence | Status |
|---|---|---|---|
| CS-01 | On signed Android AAB, report a test user | App version, device, report id, API status, queue item | NOT RUN |
| CS-02 | Report each actually supported UGC target (story/event/listing/message) | Supported target matrix; successful persistence | NOT RUN |
| CS-03 | Repeat same report and rate-limit burst | Idempotent result; safe throttling | NOT RUN |
| CS-04 | Offline and backend 500 | Clear failure; no false success | NOT RUN |
| CS-05 | Normal user requests admin queue | 403; no sensitive report leakage | NOT RUN |
| CS-06 | Authorized admin triages test report | Authenticated case view; decision audit trail | NOT RUN |
| CS-07 | Hide a **synthetic test** story | Hidden in DB/API/map/feed and new realtime reads; check caches | NOT RUN |
| CS-08 | Block user and report a blocked user | UI works; report accepted where designed | NOT RUN |
| CS-09 | Under-18 account across email/OAuth, REST, Socket.IO and legacy sessions | Denied access; no map/chat/live location | NOT RUN |
| CS-10 | Dating off across screens, deep links, APIs and realtime | Unreachable | NOT RUN |
| CS-11 | Case-handling tabletop exercise using **synthetic scenario only** | Owner triage, containment, lawful escalation decision, retention/deletion log | NOT RUN |
| CS-12 | Child Safety web URL after approved deployment | Anonymous HTTP 200, final text, contact, date, mobile layout | NOT RUN |

## Execution sequence and hard stop

1. Restore `g88-api` in a controlled, independently validated release. Existing Render blockers: migration history drift and runtime `ESSLREQUIRED`. **Never bypass drift guard or alter production migration history to pass a test.**
2. Confirm deployed API commit, database schema presence, access controls and staging/prod separation; no test CSAM content.
3. Use test accounts and synthetic, non-illegal report content on an isolated environment first.
4. Run signed AAB tests, capture redacted request/report IDs and moderation decision evidence.
5. Complete legal review and contact-email test, then remove candidate warning in the HTML and set approved effective date.
6. Merge PR #1140 to `master` only with owner/reviewer sign-off, verify Render static deployment and public URL, then consider Play Console self-certification based on actual evidence.

**Do not upload, copy, retain or email suspected CSAM as part of testing.** If a real incident occurs, follow authorized legal response channels rather than test workflows.

## Read-only Render diagnostic update — 19 Nov 2026

- Render workspace `g88`, service `g88-api` (`srv-d8d8ujojs32c73fb1gfg`): last deploy `dep-dbv73kd6e07s73auuu10` at 03:50 UTC is `build_failed`, source commit `7394aae2`. Auto-deploy is off.
- Render build command ends with `pnpm --filter @g88/backend migration:run`; migration guard rejects 15 database-history filenames absent from checkout. Do **not** delete migration rows, add unverified aliases or rerun migrations against production.
- Render application logs at 03:53 UTC show TypeORM retries with `(ESSLREQUIRED) SSL connection is required for user: postgres`.
- Current master `apps/backend/src/app.module.ts` calls `resolvePostgresConnection(url, process.env)`; `apps/backend/src/config/postgres-ssl.ts` requires verified TLS in production and for Supabase hosts and strips URL `sslmode` to prevent driver override. Unit tests exist in `postgres-ssl.spec.ts`. **This source-code inspection does not establish which older commit is currently running or the effective Render environment.** Do not assume the source TLS resolver is defective or that a redeploy fixes the service.
- No live HTTP health or Child Safety URL success could be independently established. Runtime QA remains blocked.

### Controlled remediation prerequisites

1. Inspect current running deploy/commit and effective non-secret configuration flags, including whether `NODE_ENV` is production, whether the database target is a managed Supabase host and whether the CA variable is set. Never print `DATABASE_URL`, credentials or certificate contents.
2. Validate the effective TLS resolver/pg client with a safe isolated connection to the same *type* of endpoint and proper trusted CA/hostname verification; do not use `rejectUnauthorized:false`.
3. Independently reconcile 85 applied DB migration filenames against 70 checkout SQL files and the 15 historical names in an isolated restored copy. Preserve fail-closed guard; require owner sign-off for any production migration plan.
4. Consider moving migration execution out of Render's ordinary build into a separately approved release step **only after** reconciliation, with explicit runtime role/permission validation.
5. Only after a successful controlled deploy, check `/health`, authentication, map queries, reporting persistence, admin decisions and signed-device behavior.
