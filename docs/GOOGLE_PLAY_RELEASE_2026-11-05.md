# NEXUS — Google Play first release gate (2026-11-05)

**Status: ANDROID CLOSED ALPHA RC1 BUILT / PLAY SUBMISSION NOT CONFIRMED.** Evidence checked on **2026-11-07** (Europe/Sofia). Developer identity was verified by Google on **2026-11-06**; the earlier proof-of-address rejection is superseded by this approval. The personal developer account is registered, non-trader declared, and physical-device verification complete. A **signed AAB has been produced in CI** and saved as a GitHub Actions artifact; this does not prove a Play Console upload, accepted track release, physical-device sign-off or Production access. Phone verification and actual Play app creation are **UNKNOWN**, not failed or complete. Google Payments bank verification is a separate owner-side process and its current status is unknown; do not treat it as proof that Google Play developer identity is pending.

## Current sign-off board (2026-11-07)

| Area | Status | Evidence / next gate |
|---|---|---|
| g88 Personal developer account | **DONE** | Registration receipt and prior Play account screenshots |
| Trader declaration | **DONE — non-trader** | Google confirmation, 2026-11-05 |
| Android device verification | **DONE** | Huawei Nova 11 mobile confirmation; task disappeared in Play Console |
| Developer identity verification | **DONE** | Google email **Your identity has been verified**, 2026-11-06 08:50 Europe/Sofia |
| Contact phone | **MISSING EVIDENCE** | No current Play Console confirmation of completed SMS/call verification |
| Play app creation | **MISSING EVIDENCE** | “Create app” available 2026-11-06; no verified NEXUS app record, package reservation or track |
| NEXA → NEXUS public identity | **DONE — merged** | [PR #1045](https://github.com/ValentinGanchevA1/general/pull/1045), 2026-11-06; retain `com.g88` |
| Android signed AAB RC1 | **BUILT IN CI** | [Android Release run #42260327118](https://github.com/ValentinGanchevA1/general/actions/runs/42260327118) succeeded, commit `d240c77470ade24fa3e145d11881d8fcd946967d`, artifact `g88-release-aab` (ID `13525263640`), not expired on 2026-11-07 |
| AAB binary/signing/device smoke | **RETEST / MISSING EVIDENCE** | CI reports non-debug signing; independent artifact SHA-256, signing certificate, final Play install and functional QA remain unverified |
| Play upload / release | **NOT CONFIRMED** | Publish step deliberately skipped; no verified Play Console upload/track/release |
| Store listing & real screenshots | **REQUIRES QA** | Assets must reflect current NEXUS-branded UI; issue [#616](https://github.com/ValentinGanchevA1/general/issues/616) open and older NEXA RC3 screenshot scope is stale |
| Privacy / Data Safety / deletion | **MISSING EVIDENCE** | Source exists; hosted public URL, accurate forms, deletion request URL and flow must be tested |
| Dedicated NEXUS Terms | **PRODUCTION BLOCKER** | [#592](https://github.com/ValentinGanchevA1/general/issues/592) remains open; current app still routes Terms to Privacy |
| Physical Android QA | **RETEST REQUIRED** | [#580](https://github.com/ValentinGanchevA1/general/issues/580), [#669](https://github.com/ValentinGanchevA1/general/issues/669) open; exact NEXUS RC1 device evidence missing |
| Closed testing / production access | **NOT CONFIRMED** | Personal account: at least 12 continuously opted-in testers for 14 days, then apply for production access |

**Release decision:** **GO to owner-side Play app configuration and controlled Android RC1 QA** once Play allows; **NO-GO for production** until legal, data, device, closed testing, and access gates pass. No Google Play publication is performed by this status update.

## Verified repository baseline

- Repo: `ValentinGanchevA1/general`, default `master`. Release-status audit snapshot: `11f0aa6312f3260bbcb4139da9123bad0033e34d`. RC1 build is pinned separately; recheck HEAD before freezing another candidate.
- Product display: **NEXUS**; Android app ID / namespace: **`com.g88`** (retain intentionally); `versionName=1.0.0`; `versionCode` derived from GitHub Actions run number.
- React Native 0.83.0; `minSdk=24`, `compileSdk=36`, `targetSdk=36`.
- Signed AAB workflow: `.github/workflows/android-release.yml` → `g88-release-aab` → `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.
- Canonical current Android navigation (2026-11-04): **Map / Experiences / Opportunities / Connections / Identity** (`docs/IA_NAVIGATION.md`). Older RC3 Map/Discover/Pulse/Connections/You screenshots are NOT a valid substitute.
- Store listing draft: `docs/play-store-listing.md`; release notes: `docs/play-release-notes.md`; visual capture plan: `docs/play-assets-capture-v3.md`.
- Public privacy policy *source*: `docs/legal/privacy/index.html`. Intended URL: `https://g88-legal.onrender.com/privacy`; **live availability not independently verified**.
- Optional external deletion request page proposed: `docs/legal/delete-account/index.html` → intended `https://g88-legal.onrender.com/delete-account/`; **not deployed/verified**.
- Dedicated legal-reviewed Terms remain unimplemented: issue **#592**, `TERMS_OF_SERVICE_URL` still equals privacy URL. **Production NO-GO**.


## 2026-11-06 NEXUS release build evidence

- Branding [PR #1045](https://github.com/ValentinGanchevA1/general/pull/1045) is **MERGED** on `master`; earlier draft/Sonar-red status in this document is superseded. Public display name now **NEXUS**, technical Android ID remains `com.g88`.
- Initial [preflight run #42221845711](https://github.com/ValentinGanchevA1/general/actions/runs/42221845711) failed the required `GOOGLE_WEB_CLIENT_ID` guard.
- Follow-up [preflight run #42222245425](https://github.com/ValentinGanchevA1/general/actions/runs/42222245425) **succeeded** with artifact `g88-release-aab` (ID `13504793424`), publishing skipped.
- **LATEST reference:** [NEXUS Closed Alpha RC1 run #42260327118](https://github.com/ValentinGanchevA1/general/actions/runs/42260327118), `release/nexus-closed-alpha-rc1-20261106`, commit `d240c77470ade24fa3e145d11881d8fcd946967d`: **SUCCESS** (2026-11-06 17:35 UTC). Build, release input guards, non-debug signing guard and artifact upload steps all passed; Google Play publish step was **SKIPPED**.
- The latest `g88-release-aab` artifact (ID `13525263640`) is available in GitHub Actions; it is a ZIP workflow artifact containing the AAB, not proof of a Play release. Record the extracted AAB SHA-256 and signing certificate before Play upload.
- The AAB workflow derives `versionCode` from the GitHub run number; verify the **actual packaged versionCode** from artifact inspection and the Play UI before committing to a test track.
- Confirm effective Google OAuth Web Client ID matches backend `GOOGLE_CLIENT_ID`, and Google Maps restrictions include Play app-signing SHA-1; exercise Google Sign-In on a **Play-installed** build.
- Owner-side bank-account verification is **separate** from Play developer identity. Its final state has not been independently verified and should not be assumed to block a free test release without an explicit Console requirement.

## 1. Developer account / Play bootstrap (owner-side)

- [x] Developer account registration complete (personal, g88).
- [x] Non-trader declaration submitted per Play Console evidence. Reassess if the actual business model changes; free alone does not determine trader status.
- [x] Android device verification complete via Huawei Nova 11 (confirmed by Play Console disappearance of task).
- [x] Google identity verification APPROVED — confirmed by Play Console notification screenshot on 2026-11-06.
- [ ] Contact phone number verification — **unknown** after identity approval; inspect Play Console dashboard.
- [x] **Create app** is offered on account home (screenshot, 2026-11-06).
- [ ] Actually create **NEXUS**, type **App**, default language **en-US**, **Free** (initial plan), category **Social** — not yet evidenced.
- [ ] Configure App access/reviewer test accounts without giving the reviewer a personal admin account.
- [ ] Enter factual content rating (UGC, chat and dating/social features), intended 18+ audience, permissions, ads/financial-feature declarations based on the exact enabled build.
- [ ] Play App Signing enrolled; record **app-signing SHA-1/SHA-256** and **upload-key SHA-1/SHA-256**.

## 2. Release AAB / production configuration

- [ ] Verify current GitHub release secrets **exist and are correct** without printing their values: `GOOGLE_WEB_CLIENT_ID`, `SENTRY_DSN`, `NEXA_MAPTILER_API_KEY`, `GOOGLE_MAPS_API_KEY_RELEASE`, `GOOGLE_SERVICES_JSON`, `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`. Check Firebase, OAuth and backend deployment parity.
- [ ] Back up the upload keystore securely **outside GitHub**. Never commit keystores, credentials, local.properties, or `google-services.json`.
- [ ] In Play Console, verify the signing certificates; restrict the Google Maps Android key to `com.g88` + the **Play app-signing** SHA-1 (also upload-key SHA-1 if testing sideloaded release APKs).
- [ ] Verify backend production HTTPS, migrations, Redis durability, and app API connectivity; do not infer deployed state from merged code.
- [ ] Freeze a specific **commit SHA** after known fixes, then run **Android Release (AAB)** manually with `publish=false` and `track=alpha`. Do **not** tag/release to production as part of this prep.
- [ ] Verify run SUCCESS, inspect `g88-release-aab`, download and record `.aab` SHA-256, `versionCode`, upload certificate, package, and CI URL. A workflow definition is **not** an AAB.
- [ ] First Play upload: use the actual closed-testing track and a manual console upload; compare `com.g88`, signing and `versionCode` before submitting. No production publishing until approved.
- [ ] Verify JS bundle included, startup works without Metro, Sentry/Firebase/FCM initialized, Maps resolves on a **Play-installed** build.

## 3. Store listing / screenshots

- [ ] Use the NEXUS short/full copy in `docs/play-store-listing.md` after feature-by-feature review.
- [ ] Provide actual **512x512 PNG** store icon based on current NEXUS native launcher eye, and **1024x500 JPEG/24-bit PNG** feature graphic (no alpha).
- [ ] Capture at least **2 genuine Android phone screenshots** from the **same release candidate**; target 5–6 high-quality portrait screens. See `docs/play-assets-capture-v3.md`. No generated or obsolete app UI.
- [ ] Remove test names, private conversations, exact GPS, phone/email, ID images, debug banners, and credentials from captures.
- [ ] Verify displayed tab labels are Map / Experiences / Opportunities / Connections / Identity, not RC3's old five-tab names.

## 4. Privacy, Data Safety, legal

- [ ] Confirm public HTTPS privacy page loads without login and its text matches the current live data processing. Review the listed vendors/retention and optional Stripe/PostHog claims against enabled production features.
- [ ] Deploy and test external `/delete-account/` request page; confirm its mailto path works and the operator can actually process requests. This external URL is required even when in-app Settings → Delete account works.
- [ ] Complete **Data Safety** from the release build and runtime config: account/profile, precise-location processing (sent to server then coarsened), approximate stored presence, chat/UGC, media/ID verification, diagnostics, third-party SDKs, retention and deletion. Do not claim precise GPS never leaves the device.
- [ ] Test the in-app deletion flow with a disposable tester and verify backend/media/analytics cleanup including retries.
- [ ] Issue #592: obtain legal-reviewed dedicated Terms for the actual product scope; publish a separate `/terms` URL; switch `TERMS_OF_SERVICE_URL`; test Auth/Settings/Help links and external HTTPS reachability. **No fabricated legal text.**

## 5. Closed test, device QA and production approval

- [ ] Complete issue #580 plus `docs/IA_NAVIGATION.md` v3 device regression for the exact candidate; issue #669 animated-launch calibration and accessibility.
- [ ] Smoke: cold start/login/onboarding; five navigation controls; Map → Experiences → Opportunities preserves camera; Connections; Identity; wave/chat, events/listings, profile verification, privacy, permissions denied, offline/reconnect, push and account deletion.
- [ ] Capture device model, Android version, run URL, commit SHA, artifact SHA-256, pass/fail and evidence links for each blocking test.
- [ ] Recruit at least **12 opted-in closed testers for 14 consecutive days** for the new personal account; after that **apply** for production access (not automatic approval).
- [ ] Confirm closed-test tester list + opt-in URL and at least one Play-installed smoke pass.
- [ ] **PRODUCTION NO-GO** until required phone verification (if still outstanding), store declarations, dedicated Terms #592, platform safety/QA, closed testing, and Play production access are complete. Developer identity was verified on 2026-11-06.

## Official policy references (verify before submission)

- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- New personal account testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Store visual asset specs: https://support.google.com/googleplay/android-developer/answer/9866151
- External account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111

**Do not conflate:** source code present ≠ CI run succeeded ≠ artifact signed ≠ Play upload accepted ≠ device QA passed ≠ production approval.
