# NEXUS RC1 Android — 18+ age bootstrap + map QA sign-off (2026-11-10)

**Status:** TEST PLAN ONLY. No physical-device results claimed. Test only against an isolated staging API and disposable accounts; do not turn on `NEXUS_REQUIRE_ADULT_AGE` in Render production.

## Preconditions & evidence

- [ ] Verify isolated staging database, Redis and push providers; no production account, API token, Google OAuth callback, storage or notification destination.
- [ ] Reconcile 15 migration history names in staging (#1092); no migration runner bypass or tracker edits.
- [ ] Use an exact GitHub Actions sideload Release APK build for PR #1096; record full commit SHA, workflow run, APK file SHA-256, `versionCode`, ABI, build variant, signer and install source. Never assume CI success means tested on a device.
- [ ] Record Android model/OS/API level. Preferred owner device: Huawei Nova 11; also test at least one GMS-supported Android handset or emulator because Play Services/Google OAuth may not work on every Huawei configuration.
- [ ] Use synthetic accounts only: exactly 18 today (UTC boundary), 17, a verified adult with saved DOB, a Google-created account without DOB, and a legacy account with DOB NULL. Never collect or publish real DOB, GPS, access tokens, identity docs or OAuth credentials in evidence.
- [ ] Use read-only API logs/telemetry and sanitised screenshots/video/recording with timestamps, no secrets. Ensure app/build target the exact isolated staging API.

## Eligibility pass/fail scenarios

| ID | Test | Required result |
| --- | --- | --- |
| A01 | Flag OFF, existing adult email login | Server status `required:false, eligible:true`; no age prompt; existing flow and five tabs work |
| A02 | Flag ON, registered email age 18 today | Server confirms eligible; profile setup opens once, DOB prefilled from owner's profile |
| A03 | Flag ON, Google OAuth creates a new DOB-NULL user | Screen blocks map/social until DOB submitted and server GET recheck confirms eligibility |
| A04 | Flag ON, legacy DOB-NULL user logs in/refreshes/restores | Age screen is shown; no map/socket/push/notification/deeplink until eligible |
| A05 | DOB under 18 | Local validation blocks submit; backend also rejects forged/malformed POST/PATCH; no Social route |
| A06 | Invalid calendar date, leap day and exactly-18 UTC boundary | Same results on JS and NestJS; server is authoritative |
| A07 | Google account already has eligible stored DOB | No DOB prompt after server check; never trust Google identity claims as age proof |
| A08 | Existing stored DOB conflicts with proposed value | Server returns conflict; no overwrite and no Social access |
| A09 | Network offline, timeout or DB error during status GET | Fail closed, retry or logout visible; no access to Map, Chat, Pulse, Events |
| A10 | PATCH succeeds but GET status recheck fails | Stays blocked; retry status query eventually unlocks only after confirmed eligible |
| A11 | Account switch or logout while status request in flight | Stale response is ignored; new identity must be verified independently |
| A12 | Expired JWT/refresh failure | No Social access; account may sign out and authenticate again |
| A13 | Deep link, push payload, foreground message and reconnect before approval | No privileged navigation/push registration/socket join; pending links processed only once eligible |
| A14 | Complete age, then background/foreground and cold start | GET status rechecks eligibility; no duplicate DOB submission, no private-data leak |
| A15 | TalkBack + dynamic font + keyboard navigation | DOB modal/buttons/errors spoken correctly; error and retry actions reachable |

## Full Android map regression on eligible account

| ID | Test | Expected behavior |
| --- | --- | --- |
| M01 | Cold start → Map + initial viewport | No blank map, stable camera, correct location permission flow |
| M02 | People avatar pins (compact ↔ standard) | No flicker/duplicate pins; correct transition by zoom/density |
| M03 | Select a compact avatar pin | Opens intended user card once, can deselect/back, no wrong-profile contact |
| M04 | Pan/zoom and cluster expansion | Viewport-driven PostGIS data, no stale layers or repeated infinite fetch |
| M05 | Event and listing pins | Correct content, privacy and tap target, no implicit RSVP/purchase |
| M06 | Five primary tabs / legacy deep links | Map, Discover, Pulse, Connections, You reachable according to current tab aliases |
| M07 | Message/location share from authorized conversation | Block/leave revokes access; never receives unauthorized fine GPS |
| M08 | Background/foreground, app restart, socket reconnect | No leaking room membership or incorrect online presence |
| M09 | Offline/reconnect | Fail safe; no unhandled crash or unbounded retry |
| M10 | Performance & accessibility | Tap targets, TalkBack, reduced motion, CPU/battery and no memory leak after repeated map navigation |

## Evidence recording

For every test, record `PASS | FAIL | BLOCKED | NOT RUN`, linked CI run + SHA, device/OS, test account class (not DOB), timestamp (UTC), sanitized screen recording or screenshot, backend/network trace without secrets, and issue/PR for any failure.

**Automatic vs physical evidence:** Mobile Jest/Typecheck, NestJS tests, CodeQL/SonarCloud and Release APK build may pass without any APK ever being installed. None of that establishes a physical Android, Huawei or Google OAuth sign-off. Store real install and runtime results before marking device QA complete.

## Release decision
**NO-GO** until all P0 eligibility cases, map security and legacy login restore pass on devices; staging isolation and backup tests are proven; 18+ legal/Play policy approved; Dating OFF proven in release AAB; and owner explicitly authorizes deployment. The backend age flag remains OFF in production until then.
