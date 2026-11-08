# NEXUS — Google Play Console / Finish setting up your app

**Prepared:** 7 November 2026. **Status:** working Play Console entry sheet, **NOT submitted or signed off**.
**Console:** https://play.google.com/console/u/0/developers/7979767954237794759/app/4973636174477114914/app-dashboard
**Technical identity:** Android `com.g88` (must not change for this release). **Public brand:** NEXUS.
**Evidence bases:** PR #1066 (`975590aa`), PR #1067 (`6c622bba`), cross-PR PostGIS smoke [42397690398](https://github.com/ValentinGanchevA1/general/actions/runs/42397690398), and `docs/play-data-safety-rc1-2026-11-07.md`. **Exact final signed AAB, live Play declarations, public policy hosting, and live runtime flags have NOT been verified.**

> Never click **Submit** or select definitive answers for unresolved policy questions merely because the working recommendation below is written. A green CI does not mean Google Play compliance, legal approval or Play submission.

## A. Let us know about the content of your app

| Console section | Draft answer / required input | Status / blocking evidence |
|---|---|---|
| **Set privacy policy** | Candidate `https://g88-legal.onrender.com/privacy`; in-app constant points there. Source HTML `docs/legal/privacy/index.html` is NEXUS branded. | **BLOCKED** until latest content has been deployed and URL can be opened anonymously worldwide on HTTPS; neither source commit nor Render's "Live" label proves text is deployed. Legal review also required. |
| **Sign in details** | **Access restricted: Yes.** Email/password and Google OAuth available. Provide a persistent *reviewer-only* account + password via **Play Console**, never GitHub. Account must have completed verification for core Map, chat, Story, event/listing reports. Describe location permission, optional phone/ID verification and testing path. | **BLOCKED** until test credentials and no-OTP/OTP route proven on *target backend*, verified consent version deployed. |
| **Ads** | **Likely No** for free-first-launch if no ads, native sponsored units, cross-promotion ads or advertising SDKs actually active. Marketplace listings are not automatically third-party advertising. | **VERIFY** release dependency/SDK manifest and runtime; no ad SDK appears in mobile package's direct dependencies, but transitive/remote behavior is still unknown. |
| **Content rating** | Complete IARC questionnaire **truthfully**: public UGC (profiles/photos/videos/listings), direct chat, optional dating, location sharing, peer interactions and moderation. Do not guess the eventual age rating. | **BLOCKED** until UGC, child-safety moderation, optional Dating exposure and reporting flows are verified. IARC rating is computed from the complete feature/content answers, not from a declared 18+ product minimum. |
| **Target audience** | **Owner confirmed: only optional Dating/matchmaking is 18+.** Ordinary social account creation does not require an 18+ birth date. **Do not select “18 and over” merely because optional Dating is adult-only.** Exact age groups for the social app are still undecided. | **BLOCKED:** Determine minimum age for general social use; audit stranger-chat/map/location safeguards and child-targeting restrictions before selecting under-18 groups. Incidental Dating requires effective age verification/gating, not only a self-declared birthday. [Decision #1068](https://github.com/ValentinGanchevA1/general/issues/1068), [Google Play policy](https://support.google.com/googleplay/android-developer/answer/16838200). |
| **Data safety** | **Collects data: Yes.** **Precise Location: Yes** (raw GPS transmitted and live 1:1 sharing stored). Name, email, user ID, optional phone number; DOB and gender / optional sexual orientation; photos, videos, ID/selfie documents; messages, other UGC, analytics; diagnostics/device identifiers when enabled. Encrypted-in-transit appears to be implemented with TLS; account deletion in app exists. | **BLOCKED** until exact AAB + vendors/SDKs + final retention and sharing classification reviewed, and externally accessible account deletion path validated. Use `docs/play-data-safety-rc1-2026-11-07.md` as line-item audit, not auto-submission. |
| **Government apps** | **No** if this remains a privately operated social product with no governmental agency ownership/official government services. | **OWNER VERIFY** legal/operator identity; do not claim government affiliation. |
| **Financial features** | **Likely “My app doesn’t provide any financial features”** *only after verifying* free-first-release checkout disabled, no financial wallets/transfers/loans/investments, no monetizable rewards or points. Peer-to-peer listing/offer flow does not automatically mean a payment or financial-services feature. | **VERIFY** actual build + backend `ENABLE_PAID_SUBSCRIPTIONS`, Stripe exposure and whether in-app rewards have cash value. Complete declaration even if answer is No. |
| **Health** | **Likely “My app doesn’t provide any health features”**: NestJS `HealthModule` is infrastructure health monitoring, not patient/fitness data. | **VERIFY** no customer-facing health/fitness feature or health-data capture. Complete declaration even if answer is No. |

**Data Safety caveats**: Optional user-initiated precise chat sharing and backend storage are **collected** despite private recipient selection. Public map GPS coarsening to H3 ~120m does not meet Google's 3 km² approximate-area threshold. “Collected” and “Shared” are different Play definitions—do not infer the latter solely from having 1:1 chat or contractors. Evaluate each type's purposes, optional/required status, transient/persistent handling and user deletion behavior against actual Google form.

## B. Manage how your app is organized and presented

| Field | Working answer | State |
|---|---|---|
| App or game | **App** | Proposed |
| Pricing | **Free** initial release | User decision / checkout code disabled, confirm Console |
| Category | **Social** | Proposed; must select in Console |
| Tags | Social / Local / Map **only if actual selectable options** | Console-specific choices unverified |
| App name | **NEXUS** | Draft; `com.g88` stays unchanged |
| Default language | English (United States), unless app's existing configured default differs | **VERIFY** Console |
| Support email | `vganchev6@gmail.com` appears in `apps/mobile/src/constants/app.ts` | **OWNER CONFIRM** before publicly displaying |
| Website | Optional; no official NEXUS marketing homepage has been verified | Unknown |
| Privacy policy | `https://g88-legal.onrender.com/privacy` | External content unverified |
| Store listing | Use current `docs/play-store-listing.md` with screenshots captured from the actual Android release candidate. | **READY FOR REVIEW**, not upload |

### Recommended copy (English, current functional scope)

**Name (max 30 chars):** `NEXUS`

**Short description (max 80 chars):**

```text
Discover nearby people, local events and listings on a live map
```

**Full description (max 4,000 chars):**

```text
NEXUS is a map-first social app for discovering people and local activity around you.

Explore nearby profiles, events and listings from one live map. Find local experiences, discover opportunities, connect with people through waves and chats, and stay in touch with your connections.

DISCOVER NEARBY
See nearby people and local activity, explore places and view map-based events and listings.

CONNECT
Wave to someone, open a conversation and manage your connections in one place.

EXPERIENCES AND OPPORTUNITIES
Discover events, join local activities, browse community listings and exchange offers.

YOUR IDENTITY, YOUR CHOICES
Manage your profile and verification options. Choose your map visibility. Public map discovery uses privacy-coarsened location; precise live location sharing in a one-to-one chat is optional and initiated by you.

NEXUS brings local discovery, real-time interaction and useful nearby activity together.
```

**Do not falsely advertise** a dedicated “Pulse” bottom tab; current Android navigation is **Map / Experiences / Opportunities / Connections / Identity**. Local Pulse activity may still exist as a content surface. Never show a public trust score or claim GPS never leaves the device.

### Graphics and screenshots

| Asset | Verified Google Play requirement | Source needed |
|---|---|---|
| Store icon | **512 × 512 PNG (32-bit with alpha), ≤ 1024 KB** | Final NEXUS brand asset |
| Feature graphic | **1024 × 500 JPEG or 24-bit PNG (no alpha)** | Final NEXUS art |
| Phone screenshots | **At least 2** valid screenshots; **4 × 1080 × 1920 portrait recommended** for app discovery. PNG/JPEG, 320–3840 px with longer dimension ≤ 2× the shorter. | **Capture from exact current build**, not concept art |
| Suggested 5 screenshots | Map and people, event experience, opportunities/listing, Connections/chat (no real user private data), Identity/privacy settings | Redact personal data and temporary test-account names. |
| Promotional video | Optional | Current recorded app behavior only |

The Android E2E screenshots currently attached to GitHub run logs show a **trust-required empty Map**. They are valuable QA evidence but **poor marketing screenshots**. Capture real populated, consented demo data on the same release candidate instead of faking features.

## C. Reviewer login details — store securely in Play Console only

- Reviewer account email: **TO CREATE / DO NOT COMMIT**
- Reviewer password: **TO CREATE / DO NOT COMMIT**
- Backend/environment reachable by the same APK: **TO VERIFY**
- Email / phone verification state: **TO VERIFY**, ideally preverified synthetic reviewer account
- Instructions: “Launch NEXUS → Sign in using the provided test credentials → Map → Connections → Chats; Experiences and Opportunities are accessible from the bottom navigation. If Android asks for location permission, allow while using the app to test nearby map features. Please use only the provided demo users for chat and reports.”
- If updated Terms is enforced, reviewer must be able to explicitly accept it; a legally unapproved draft must not be misrepresented as final Terms.

## D. Ship gates before we fill or submit the Console

1. [ ] PR #1067 versioned Terms acceptance merged **after** Android E2E and legal decision.
2. [ ] PR #1066 UGC reporting / dating DOB / Data Safety merged **after** CI and device QA.
3. [ ] New file version of Terms actually published at `/terms`, approved by qualified reviewer; mobile `TERMS_OF_SERVICE_URL` no longer points to Privacy.
4. [x] Dating-only 18+ product decision made [#1068](https://github.com/ValentinGanchevA1/general/issues/1068).
   - [ ] Release CI and device-test onboarding without universal 18+ birthday requirement.
   - [ ] Review robust age verification for adult-only Dating and cross-feature bypass risks.
   - [ ] Decide exact general-social audience buckets and legal safeguards; no child-targeting selection is assumed.
5. [ ] `/privacy` and `/delete-account/` open anonymously on HTTPS, with accurate latest product/operator/content.
6. [ ] Moderation team workflow/report queue, user blocking, and abuse response tested; UGC Terms accepted **before** upload.
7. [ ] Signed release **AAB** produced from frozen merged commit; verify manifest permissions, dependencies, feature flags, target SDK and release signing.
8. [ ] Android physical-device flow and Two-Device E2E pass using the signed candidate (including stored vs live precise GPS).
9. [ ] All Data Safety questions independently mapped to shipped code and providers.
10. [ ] Reviewer test login verified, no credentials in Git.
11. [ ] IARC answers, target audience, government/financial/health forms, contact and store details verified by owner.
12. [ ] Actual screenshots and store icon / feature graphic uploaded; release track, Play App Signing and versionCode confirmed.
13. [ ] **If a personal developer account created after 13 Nov 2023**, Google Play requires a closed test with **12 opted-in testers continuously for 14 days**, followed by an application for production access. Do not assume test eligibility from CI alone.

## E. Google Help references (live policy)

- Prepare app content: https://support.google.com/googleplay/android-developer/answer/9859455
- Dashboard setup: https://support.google.com/googleplay/android-developer/answer/9859454
- Store listing: https://support.google.com/googleplay/android-developer/answer/9859152
- Store graphics: https://support.google.com/googleplay/android-developer/answer/9866151
- Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- UGC / Terms acceptance: https://support.google.com/googleplay/android-developer/answer/9876937
- Financial features declaration: https://support.google.com/googleplay/android-developer/answer/13849271
- Health declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Personal developer account testing: https://support.google.com/googleplay/android-developer/answer/14151465

**Console state:** not inspected through an authenticated Play Console session; every listed section is **unsubmitted/unverified** unless the owner shares verified Console evidence. A source draft is **not** a Play declaration.


## Release hold — Dating disabled until age assurance is approved

**Decision for current technical release candidate (8 Nov 2026):** preserve the product's **Dating-only 18+** policy, but keep the adult-only Dating feature **disabled** until independent, effective age-assurance and safety controls are implemented, verified and signed off. Backend `NEXUS_DATING_RELEASE_ENABLED` defaults to `false`; Dating like/pass, profile opt-in, Dating discovery and realtime subscriptions reject or return empty. Mobile first-release code hides the Dating map filter and opt-in control. This is an interim engineering safety gate, **not a substitute for verifying legal target age groups or operating a real age-verification system**.

- [ ] Verify `NEXUS_DATING_RELEASE_ENABLED` **unset/false on production** before AAB upload, and again after backend deployment.
- [ ] Android device QA: Dating filter and opt-in absent; user cannot access likes, matches or Dating-only entities from saved links, old sessions or direct requests; ordinary social map/chat continue working.
- [ ] Test **previously created Dating matches**: their stored conversation IDs must not be exposed by social conversation-list and profile-message routes, and must fail on chat send, message read and realtime room recipient authorization while Dating is paused. Ordinary unrelated DMs continue to work; since an earlier Dating match may reuse a general DM, review the effect on established social conversations.
- [ ] Verify an already active precise live-location share in such a match can still be **stopped** by the sharer, but no new location updates or live delivery occur while Dating is disabled.
- [ ] Admin and legal approval required before any future enablement; do not simply flip the flag to true on a self-declared DOB.
- [ ] IARC must describe the **actual shipped** user-accessible functionality; don't claim enabled Dating if unavailable. Reassess when re-enabled.
- [ ] Keep Social category and general target-audience safeguards under review. Even without Dating, random/anonymous stranger-chat functionality can independently trigger Play restrictions: https://support.google.com/googleplay/android-developer/answer/16302250 .

## F. Dating-only 18+ owner decision (7 Nov 2026)

NEXUS is **primarily a contextual, map-first social application**, with optional Dating/matchmaking restricted to adults. According to Google's April 2026 clarification, apps with **incidental** Dating can avoid *app-wide* Restrict Minor Access **if** they implement sufficiently robust feature-level age gates: https://support.google.com/googleplay/android-developer/answer/16838200 . A DOB entered by the user is not proof of age; require technical/abuse review before relying on this exception. The general/social audience age bands are **NOT YET CHOSEN** and must not default to under-13 or Families without safeguarding compliance. Social app Child Safety Standards apply independently of the eventual minimum age: https://support.google.com/googleplay/android-developer/answer/14747720 .


### Play Console age / incidental Dating entry rules (owner-confirmed scope)

| Console prompt | Draft selection | Evidence or hold |
|---|---|---|
| **App category** | **Social**, not Dating, if real release remains primarily local-social | Verify Map / Experiences / Opportunities / Connections functionality and public listing |
| **IARC Category** | **Social or Communication** | Answer UGC, user-to-user communication, exact location-sharing and Dating truthfully; IARC calculates the resulting rating |
| **Target age groups** | **DO NOT SELECT YET** | Adult-only Dating does **not** make the entire app 18+. Determine the **lowest permissible age** for general social use, per-country safety and legal review |
| **Restrict Minor Access (app-wide)** | Not automatically required for **incidental Dating** | Official April 2026 clarification allows effective *feature-level* age-gating; cannot claim exemption if Dating is core or only an easily changed birth-date field is used |
| **App access for reviewer** | Social test account + separate 18+ Dating reviewer path (if accessible) | Provide credentials and exact steps securely in Console; do not store them in GitHub |
| **Dating age verification** | Birth-date currently self-reported; **insufficient evidence of robust age verification** | Test identity-age claims, stale DOB changes, OAuth, map filters, API and Socket.IO bypasses before production |
| **Child Safety Standards** | **Required for Social category regardless of chosen minimum age** | Publish anti-CSAE standards, in-app reporting, CSAM procedures and designated safety contact; Google policy applies even to adult-gated apps |

**Do not select ages 13–15 or below by default.** Google prohibits social apps whose main purpose is open/random/anonymous stranger communication from targeting children, and underage targeting may trigger Families requirements. Ages **16–17 + 18+** are only an *evaluation scenario*, not an authorized selection: first demonstrate suitable safeguards for teen users and applicable law. If safeguards cannot be provided for younger audiences, revisit the general-social minimum age or postpone launch. Do not declare “no minors” while intentionally admitting teenagers.

**Data Safety:** Keep **Precise Location = collected** (map GPS server processing and optional precise 1:1 location sharing) regardless of age policy. A DOB is not mandatory at general registration, but it is collected **when provided** for optional Dating and profiles. Review optional gender/orientation, verification documents, direct messages and per-recipient sharing independently of the target-audience checkboxes.

**Child-safety interaction concerns requiring explicit QA:** unknown-adult-to-minor discovery/chats, precise 1:1 live-location sharing, unsolicited waves and offers, map profile visibility, event meetups and reporting/abuse escalation. The current code and draft policies do not prove these risks are fully mitigated.

Official sources:
- https://support.google.com/googleplay/android-developer/answer/16838200
- https://support.google.com/googleplay/android-developer/answer/16302250
- https://support.google.com/googleplay/android-developer/answer/9867159
- https://support.google.com/googleplay/android-developer/answer/14747720
- https://support.google.com/googleplay/android-developer/answer/18265346
