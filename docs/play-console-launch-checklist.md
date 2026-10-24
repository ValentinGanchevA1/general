# NEXA — Play Console closed-testing and production checklist

> **Scope:** owner-side Google Play Console steps for shipping **NEXA** while preserving the existing Android package `com.g88` for compatibility.
> Core build/release automation is in place, but physical-device QA and the dedicated Terms requirement in #592 remain release gates.
> Background + rationale: `DEPLOY.md` → "Mobile release". Paste-ready store copy:
> `docs/play-store-listing.md` and `docs/play-release-notes.md`.

Work top to bottom. Do not treat a successful CI build as device or production sign-off.

---

## 0. Before you start — have these open

- [ ] Google account used as the **Play developer** (personal or organization).
- [ ] **Google Cloud Console** project that owns `GOOGLE_MAPS_API_KEY_RELEASE`.
- [ ] `docs/play-store-listing.md` (NEXA name, short/full description, Data Safety notes).
- [ ] `docs/play-release-notes.md` (tester-facing release notes).
- [ ] Privacy policy URL: `https://g88-legal.onrender.com/privacy` — verify it loads and visibly says **NEXA**.
- [ ] Issue #592 — dedicated NEXA Terms of Service. Closed testing may continue while reviewed, but production is **NO-GO** until a real `/terms` document is live and the app no longer routes Terms to Privacy.
- [ ] Issue #580 — physical-device NEXA release audit.
- [ ] Tester email addresses (Google Group or explicit list).

---

## 1. Register / verify the developer account

- [ ] Play Console → create or verify the developer account using the ownership model you intend to keep.
- [ ] Complete any identity/contact requirements shown by Play Console.
- [ ] Keep ownership/recovery access separate from release automation credentials.

## 2. Create or verify the Play app identity

- [ ] Play Console → **Create app** if the app does not already exist.
  - App name: **NEXA**.
  - Default language: choose the launch-market default.
  - App type: **App**.
  - Pricing: according to the actual launch model.
- [ ] Preserve package/application id **`com.g88`**. It is a compatibility identifier, not the public product name.
- [ ] Do **not** create a second package only to rename the technical namespace.

## 3. Configure Play App Signing + closed testing

- [ ] **Test and release → Testing → Closed testing → Create track** (for example `beta`).
- [ ] **Testers** → add the approved Google Group or email list → save.
- [ ] Confirm **Play App Signing** is enabled.
- [ ] Record both certificates shown under **App integrity**:
  - App signing key certificate.
  - Upload key certificate.

## 4. Maps SHA-1 — required for real Play installs

Play re-signs distributed builds with the **App signing key**, so the certificate on a tester device is not the upload/debug certificate.

- [ ] Play Console → NEXA → **Test and release → Setup → App integrity → App signing** → copy the **App signing SHA-1**.
- [ ] Also copy the **Upload key SHA-1** for sideload/release-build diagnostics.
- [ ] Google Cloud Console → **APIs & Services → Credentials** → `GOOGLE_MAPS_API_KEY_RELEASE`:
  - Application restrictions = **Android apps**.
  - API restrictions = **Maps SDK for Android**.
  - Add package `com.g88` + **App signing SHA-1**.
  - Add package `com.g88` + **Upload key SHA-1** when sideloaded release builds also need Maps.
- [ ] Keep the debug key separate.

A grey/blank map on Play-installed builds is a release blocker until this restriction is correct.

## 5. Build and upload the first AAB

- [ ] GitHub Actions → **Android Release (AAB)** → produce a fresh release candidate.
- [ ] Download the `g88-release-aab` artifact. The artifact name is a technical compatibility name; the public app remains NEXA.
- [ ] Play Console → **Closed testing → track → Create new release**.
- [ ] Upload the `.aab`.
- [ ] Paste release notes from `docs/play-release-notes.md`.
- [ ] Review the resolved package/version/signing details before rollout.
- [ ] Roll out only to the intended closed-testing track.

## 6. Store listing + policy declarations

- [ ] **Main store listing** uses **NEXA** everywhere: app name, descriptions, icon, feature graphic and screenshots.
- [ ] Screenshots show the current Map / Discover / Pulse / Connections / You UI and final NEXA entity grammar.
- [ ] **Privacy policy** points to `https://g88-legal.onrender.com/privacy`; public page content must be NEXA-branded even though the infrastructure hostname is legacy.
- [ ] Complete **Data Safety** from the release build and actual architecture, not from branding assumptions. Confirm at minimum the real handling of:
  - location;
  - account/profile information;
  - photos/video and verification uploads where enabled;
  - messages/interactions;
  - diagnostics/analytics;
  - deletion behavior.
- [ ] Confirm data-in-transit encryption declarations against production configuration.
- [ ] Confirm account deletion is described consistently with the in-app delete flow.
- [ ] Complete content rating, target audience, app access and any other Play declarations truthfully.

## 7. NEXA legal gate — production only

Closed testing may proceed while Terms are under review, but production must remain **NO-GO** until all items below pass:

- [ ] #592 is resolved with legal-reviewed Terms content for the actual NEXA feature set.
- [ ] Dedicated public Terms URL is live (preferred compatibility path: `https://g88-legal.onrender.com/terms`).
- [ ] Terms page title/header/footer visibly use **NEXA**.
- [ ] `TERMS_OF_SERVICE_URL` resolves to `/terms`, not `/privacy`.
- [ ] Auth, Settings, Help and About open the dedicated Terms page.
- [ ] Privacy and Terms are separate documents.
- [ ] A non-authenticated browser can load both public URLs.

Do not ship production with a control labeled **Terms of Service** that opens Privacy Policy content.

## 8. Ship to closed testers

- [ ] Copy the closed-testing opt-in URL from the configured track.
- [ ] Install from Play on a real Android device.
- [ ] Confirm Maps renders with the Play app-signing certificate.
- [ ] Run the exact release candidate through issue #580.
- [ ] Smoke-test sign-in, map discovery, entity sheets, Connections, Marketplace and account settings.
- [ ] Record device/Android version and the exact release versionCode used for sign-off.

## 9. Physical-device NEXA sign-off

The exact candidate must verify:

- native dark launch → NEXA launch animation → spatial handoff with no white flash or stale artwork;
- logged-out and incomplete-profile launch paths do **not** show the map halo;
- Reduced Motion behavior;
- final entity identity: person=circle, event=four-point star, listing=square, opportunity/other=diamond;
- Map / Discover / Pulse / Connections / You navigation;
- light / dark / system / PROTOS NEXUS theme behavior;
- no visible legacy `G88` product branding;
- no public numeric trust/popularity score or trust-booster language;
- privacy-safe map presence and no exact-coordinate exposure;
- TalkBack, larger text and 44dp interaction targets.

## 10. Optional automation after the first manual release

If Play/API publishing is enabled later:

- [ ] Create a dedicated Play publishing service account with minimum required access.
- [ ] Grant only the target app/release permissions needed for the chosen workflow.
- [ ] Store the service-account credential in the configured GitHub secret.
- [ ] Validate automation first against a testing track; do not grant broader production rights than needed.

---

## Production go / no-go

Production is **GO** only when all of the following are true:

- [ ] exact release candidate passes #580 on a physical Android device;
- [ ] #592 dedicated Terms requirement is resolved;
- [ ] Privacy/Terms/Data Safety/store copy match actual production behavior;
- [ ] Play App Signing + Maps restrictions are verified on a Play-installed build;
- [ ] no P0/P1 product, privacy, trust, abuse-prevention or release regressions remain.

Technical identifiers such as `com.g88`, `@g88/*`, storage keys, signing certificate OU and the `g88-legal` hostname are compatibility/infrastructure identifiers. They must not be mechanically renamed as part of the NEXA visual/release migration.
