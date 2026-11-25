# NEXUS Social 18+ — release verification matrix (2026-11-25)

**Status: IMPLEMENTATION CANDIDATE / TEST PLAN ONLY. No age-gate device results are claimed.**

Product-owner release scope: **NEXUS Social is 18+ for the first public release; Dating is disabled** (#1068, #1071). A product-owner Release approval is not legal approval. A qualified legal reviewer must later approve the final Terms, Privacy and Child Safety Standards before public publication / Play submission.

## Current implementation / deployment facts

- Backend contains `GET /api/v1/auth/age-eligibility` and `PATCH /api/v1/auth/age-eligibility`.
- Live Render `g88-api` startup logs on 2026-11-25 show both routes mapped, and the Nest application started on commit `0518d5530582b52de0fb86c2331711686c070d9d`.
- `NEXUS_REQUIRE_ADULT_AGE` remains **OFF/unverified in the connected Render environment**. No value was read or changed as part of this work.
- The gate is server-authoritative when enabled: the stored PostgreSQL DOB is checked; the JWT contains no DOB. Backend database errors fail closed for protected REST access and realtime events.
- This branch adds session-scoped Redux eligibility state and restricts authenticated navigation until the server returns eligible. It also delays push registration, realtime-capable app navigation, notifications and pending deep links until eligibility is confirmed.
- Do not ship this mobile bootstrap ahead of a backend that serves both age endpoints. The live API currently maps them, but a separate isolated staging service still has to be provisioned and proven.
- A green APK/CI check does not replace physical-device age-gate QA.

## Preconditions — all required before setting the age flag ON

- [ ] Separate disposable staging API + Postgres/PostGIS + Redis. Verify provider project/instance IDs and DNS/network separation independently from connection strings.
- [ ] Separate staging JWT/auth secrets, OAuth callback, media bucket, push provider and email/SMS destinations; use test/sandbox credentials.
- [ ] No production users, messages, exact GPS, refresh tokens, identity documents or private media copied into test staging. Synthetic identities only.
- [ ] Reconcile migration-history drift and verify schema on the isolated target (#1092); no manual migration-history edits or production migration runner bypass.
- [ ] Confirm release branch backend SHA and mobile SHA are mutually compatible. The API endpoints must be deployed before this client reaches any tester.
- [ ] Keep `NEXUS_REQUIRE_ADULT_AGE` unchanged in production until owner-approved rollout after exact-SHA device tests.
- [ ] Keep Dating disabled. The first-release Dating server guard and mobile hiding work is in separate PR #1173 and must merge/build/test before release.

## Adult-eligibility cases

Record each result as `PASS | FAIL | BLOCKED | NOT RUN`. Do not include real DOB, email, user ID, GPS, access tokens or identity information in evidence.

| ID | Scenario | Expected result |
|---|---|---|
| A01 | Age flag OFF; existing email account login | Server returns `required:false, eligible:true`; no age prompt; normal navigation continues |
| A02 | Flag ON; email registration with exactly-18 DOB | Backend accepts the UTC calendar-day boundary; eligible state is confirmed before Social access |
| A03 | Flag ON; Google OAuth creates DOB-null user | Age screen is sole authenticated route; profile completion, Map, Chat, Events and Discovery remain blocked |
| A04 | Flag ON; legacy account with DOB NULL logs in / restores | Age screen appears; no Map, Chat, push registration, notifications, deep links or Socket.IO privileged actions before approval |
| A05 | Under-18 DOB via UI and forged direct PATCH | UI blocks submit; backend rejects; user remains blocked |
| A06 | Invalid date, impossible calendar date, leap-day and UTC boundary | Backend rejects malformed/impossible dates; boundary is deterministic in UTC |
| A07 | Google account with already stored eligible DOB | Server check passes without relying on Google claims as age evidence |
| A08 | Attempt to overwrite an existing DOB | Server preserves existing value / returns conflict; no Social access on a conflicting result |
| A09 | Offline, timeout or DB failure on status GET | Fail closed; retry and sign-out accessible; no Social navigation |
| A10 | PATCH returns success but status GET fails or reports ineligible | App remains blocked; retry GET; only server-confirmed eligible opens Social |
| A11 | Account switch while GET/PATCH is in flight | Stale response from previous account ignored; new account requires its own check |
| A12 | Expired access/refresh token | No Social access; authentication recovery or sign-out only |
| A13 | Push/deep link/notification/realtime reconnect before eligibility | No privileged navigation or registration; pending deep link is processed only after eligible |
| A14 | Background/foreground and cold start after eligible | Eligibility is rechecked for restored session; no stale account status reused |
| A15 | Accessibility, large text, keyboard, TalkBack and error states | Date field, retry and sign-out are reachable and labelled; failures announced; no keyboard overlap |

## Backend authorization cases

- [ ] With flag ON, protected REST routes reject accounts without stored eligible DOB.
- [ ] The bootstrap GET/PATCH and narrowly exempt account access/deletion/report/block/support routes behave as intended.
- [ ] A forged JWT claim cannot grant eligibility; the database DOB is authoritative.
- [ ] Database outage/error denies protected requests without leaking DOB or internal SQL details.
- [ ] Socket.IO event guard rejects ineligible/unknown DOB users; existing sockets are evicted by each node's eligibility sweep.
- [ ] Multi-instance Socket.IO behaviour is tested; no account can continue receiving protected events after becoming ineligible.
- [ ] Email login, Google OAuth, existing account login, refresh-token flow and session restore all reach the same eligibility gate.
- [ ] Dating REST, Dating-only discovery, profile opt-in, deep links and realtime events stay disabled for first release.

## Android device matrix

Run against an isolated staging API, synthetic identities and exact signed candidate APK.

| ID | Scenario | Expected result |
|---|---|---|
| D01 | Huawei Nova 11, new email account, age gate ON | Age screen before Social |
| D02 | Huawei Nova 11, legacy DOB-null account | Age screen before Social |
| D03 | GMS-supported Android device/emulator, Google OAuth new account | Age screen before Social; OAuth flow does not bypass |
| D04 | Eligible adult after DOB status confirmed | Map / Social navigation unlocks once |
| D05 | Underage / malformed DOB | Remains blocked; no Social entry |
| D06 | Network disabled or API unavailable | Retry/sign-out remains available; no bypass |
| D07 | Cold start, restore and account switch | No stale eligibility reuse |
| D08 | Deep link / push / foreground notification pre-gate | Remains queued or ignored safely until eligible |
| D09 | TalkBack, large font and keyboard | Complete DOB and error flow accessibly |
| D10 | Dating filter/profile/deep link/REST attempt | No Dating UI or successful Dating operation |

For each case attach: exact commit SHA, GitHub Actions run, APK SHA-256, versionCode, package, signing certificate fingerprint, device model/OS/API level, synthetic account class, UTC timestamp, sanitized recording/screenshot, and redacted API evidence. No sensitive personal information.

## Release decision / sequencing

1. Merge the small age-bootstrap PR only after exact-head CI, review, backend compatibility and isolation evidence pass.
2. Keep `NEXUS_REQUIRE_ADULT_AGE` OFF on production while the signed candidate is prepared and tested on isolated staging.
3. Execute A01–A15, backend authorization cases and D01–D10 with synthetic identities on Huawei Nova 11 and a GMS-capable device.
4. Obtain product-owner Release candidate approval.
5. Have the appointed qualified legal reviewer approve final Terms, Privacy and Child Safety Standards before public publication and Play submission.
6. Confirm actual Play Console Target Audience, Restrict Minor Access, Child Safety, Content Rating, Data Safety and reviewer-access declarations against the deployed app and policies.
7. Only after all evidence and explicit owner authorization, plan the production age-flag rollout and exact signed build release.

**NO-GO for enabling the production age flag or public release until the above conditions are evidenced.**
