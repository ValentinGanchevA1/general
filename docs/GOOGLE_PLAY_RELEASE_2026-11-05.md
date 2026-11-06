# NEXUS — Google Play first release gate (2026-11-05)

**Status: PREPARING / NOT READY TO SUBMIT.** This is an evidence-driven checklist, not a declaration that a signed AAB, Play listing, or on-device sign-off exists. Owner-side Play Console screenshots show a newly registered personal developer account **g88**: trader declaration and physical Android device verification complete; identity verification pending; contact-phone verification blocked until identity approval; Create app disabled.

## Verified repository baseline

- Repo: `ValentinGanchevA1/general`, default `master`. Audit snapshot: `0d792e9c1b595fd161746586293a4a51263406a3`. Recheck HEAD and open PRs before freezing the release candidate.
- Product display: **NEXUS**; Android app ID / namespace: **`com.g88`** (retain intentionally); `versionName=1.0.0`; `versionCode` derived from GitHub Actions run number.
- React Native 0.83.0; `minSdk=24`, `compileSdk=36`, `targetSdk=36`.
- Signed AAB workflow: `.github/workflows/android-release.yml` → `g88-release-aab` → `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.
- Canonical current Android navigation (2026-11-04): **Map / Experiences / Opportunities / Connections / Identity** (`docs/IA_NAVIGATION.md`). Older RC3 Map/Discover/Pulse/Connections/You screenshots are NOT a valid substitute.
- Store listing draft: `docs/play-store-listing.md`; release notes: `docs/play-release-notes.md`; visual capture plan: `docs/play-assets-capture-v3.md`.
- Public privacy policy *source*: `docs/legal/privacy/index.html`. Intended URL: `https://g88-legal.onrender.com/privacy`; **live availability not independently verified**.
- Optional external deletion request page proposed: `docs/legal/delete-account/index.html` → intended `https://g88-legal.onrender.com/delete-account/`; **not deployed/verified**.
- Dedicated legal-reviewed Terms remain unimplemented: issue **#592**, `TERMS_OF_SERVICE_URL` still equals privacy URL. **Production NO-GO**.

## 1. Developer account / Play bootstrap (owner-side)

- [x] Developer account registration complete (personal, g88).
- [x] Non-trader declaration submitted per Play Console evidence. Reassess if the actual business model changes; free alone does not determine trader status.
- [x] Android device verification complete via Huawei Nova 11 (confirmed by Play Console disappearance of task).
- [ ] Google identity verification APPROVED (not merely documents submitted).
- [ ] Contact phone number verified after identity approval.
- [ ] **Create app** enabled; create **NEXUS**, type **App**, default language **en-US**, **Free** (initial plan), category **Social**.
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
- [ ] **PRODUCTION NO-GO** until identity/phone, store declarations, dedicated Terms #592, platform safety/QA, and Play production access are complete.

## Official policy references (verify before submission)

- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- New personal account testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Store visual asset specs: https://support.google.com/googleplay/android-developer/answer/9866151
- External account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111

**Do not conflate:** source code present ≠ CI run succeeded ≠ artifact signed ≠ Play upload accepted ≠ device QA passed ≠ production approval.
