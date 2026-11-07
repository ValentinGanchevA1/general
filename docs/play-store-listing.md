# NEXUS — Play Console Store Listing + Data Safety checklist

> Public product identity: **NEXUS**. Android package/application ID remains
> `com.g88` for compatibility and must not be renamed as part of store-copy work.
> Privacy/data claims below are grounded in the current repo architecture; verify
> the final declarations against the exact release build and current Play Console
> questions before submission.

---

## 1. App details

| Field | Value |
|---|---|
| App name | `NEXUS` |
| Package name | `com.g88` *(existing compatibility identifier)* |
| Default language | English (United States) |
| App or game | **App** |
| Free or paid | **Free** *(declare subscription/monetization features separately when enabled)* |
| Category | Social |
| Tags | Social, Local, Map |
| Contact email | ⟨support email⟩ |
| Website | ⟨landing page URL, optional⟩ |
| Privacy policy URL | `https://g88-legal.onrender.com/privacy` *(legacy host name; hosted page itself must be current and NEXUS-branded)* |

---

## 2. Store listing copy

### App name

```text
NEXUS
```

### Short description

```text
Discover people and local activity nearby on a live, privacy-aware map.
```

### Full description

```text
NEXUS is a map-first social app for discovering people and local activity around
you in real time.

Open the map to explore nearby people, events and listings. Wave to someone,
connect, continue the conversation in 1:1 chat, join local events, or explore
what is happening around you through map-based Experiences, Opportunities, and contextual Pulse activity.

WHAT YOU CAN DO
• Map-first discovery — explore nearby people, events and listings
• Experiences — select nearby events directly on the Map
• Opportunities — explore nearby listings and offers on the Map
• Pulse — see contextual local activity and live signals
• Connections — keep relationship activity and chats together
• Waves and chat — lightweight interaction that can grow into conversation
• Events — discover, join and follow local activity
• Marketplace — explore local listings and offers
• Identity verification — manage verification signals through Trust Center
• Map presence controls — choose whether you appear in nearby discovery
• Optional Dating (18+) — adult-only opt-in matchmaking and dating discovery

BUILT FOR PRIVACY
NEXUS displays privacy-coarsened locations for nearby map discovery. Separately,
you may opt into sharing precise live GPS with one other person in a 1:1 chat.
The backend retains last live-session coordinates and the location in the initial
chat message, subject to our documented retention and deletion practices.

Verification is factual and signal-based. NEXUS does not expose a public numeric
trust or popularity score.

NEXUS is designed around local context, direct interaction and spatial discovery
instead of a single endless global feed.

⟨Add closed-beta support contact or tester-specific note if needed.⟩
```

### Graphics checklist

- [ ] **App icon** — 512×512 current NEXUS launcher artwork
- [ ] **Feature graphic** — 1024×500 NEXUS-branded artwork
- [ ] **Phone screenshots** — use the current UI, not legacy G88 screens
  - [ ] Map + entity markers/sheet
  - [ ] Experiences / event map lens
  - [ ] Opportunities / listing map lens
  - [ ] Connections
  - [ ] Identity / Trust Center
  - [ ] Event or Marketplace surface
- [ ] **Theme coverage** — screenshots should not mix obsolete and current visual systems
- [ ] **Promo video** — optional; if used, show the current NEXUS launch/map experience

---

## 3. Data Safety working matrix

> Source of truth for location handling remains the implementation / architecture,
> not marketing copy. Current architecture documents that precise GPS is sent for
> public-map-position computation, immediately coarsened for nearby discovery.
> The optional live location share in a 1:1 chat is separate: it persists exact
> coordinates and delivers them to the chosen chat recipient. A ~120 m map cell
> remains more precise than Google Play's 3 km² 'approximate location' threshold;
> evaluate the Play Data Safety classification conservatively.

### 3a. Overview

| Question | Working answer |
|---|---|
| Does the app collect or share covered user data? | **Yes** |
| Is collected data encrypted in transit? | **Yes** — HTTPS/TLS; WSS for realtime |
| Is account deletion available in-app? | **Yes** — Settings → Delete account |

### 3b. Data types to validate in Play Console

| Data type | Working treatment | Purpose / note |
|---|---|---|
| **Location (Play category to verify)** | Collected | Public map presence is coarsened to ~120 m, which is still within Google's 'precise location' area threshold |
| **Precise location** | Collected | Public map processing and optional 1:1 chat sharing; last live-session coordinates and initial shared chat location are stored |
| **Name / profile identity** | Collected | Account and profile functionality |
| **Email address** | Collected | Auth / account management |
| **Phone number** | Collected when supplied | Login / verification |
| **User IDs** | Collected | Account and app functionality |
| **Profile photos / gallery** | Collected when supplied | Profile functionality |
| **Bio / interests / profile metadata** | Collected when supplied | Profile and discovery context |
| **In-app messages** | Collected | 1:1 chat persistence / delivery |
| **App interactions / analytics** | ⟨verify enabled providers in release build⟩ | Product analytics / diagnostics as applicable |
| **Crash logs / diagnostics** | Collected when diagnostics are enabled | Stability / debugging |
| **Purchase / subscription data** | ⟨verify enabled billing path⟩ | Subscription / premium functionality |
| **Government ID / verification material** | ⟨validate exact collection, retention and processor declarations⟩ | Identity verification |
| **Sexual orientation** | Collected when supplied | Explicit profile orientation field; sensitive Personal info even if public visibility is disabled |
| **Other personal info** | Collected | Date of birth, gender identity, dating preferences, profile context |
| **Videos** | Collected when supplied | User-uploaded Story video; may include audio embedded in the video |
| **Files and documents** | Collected when supplied | Identity-verification document images and accompanying documents |
| **Other user-generated content** | Collected | Stories, listings, events, check-ins, event questions and reviews |
| **Location live-share** | Collected and disclosed to an explicitly selected chat partner | Initial chat location and latest session lat/lng persist after session end; disclose precisely |
| **Other in-app messages** | Collected | DM/group chat text and attachments as enabled |

### 3c. Location declaration note

Do **not** say that precise GPS “never leaves the device.” The implementation sends precise location for nearby-position computation, then coarsens it before storing map presence. Optional 1:1 chat live-location sessions are different: they store precise coordinates in chat session and message records. Public copy should instead say:

> Public map discovery shows only privacy-coarsened location. With explicit consent,\n> a 1:1 chat peer can receive precise live location; backend stores related coordinates.

If Play Console wording or reviewer interpretation classifies ephemeral precise
location differently, use the conservative declaration required by the current
form rather than weakening the privacy explanation.

### 3d. Security / control checks

- [x] Data encrypted in transit
- [x] In-app account deletion exists
- [ ] Publish and verify the external deletion-request path: `/delete-account/` (draft in `docs/legal/delete-account/index.html`); required in addition to in-app deletion
- [ ] Current release build checked for analytics / diagnostics providers
- [ ] Current identity-verification processors and retention disclosed accurately
- [ ] Age-related sensitive fields (date of birth, gender identity, orientation and dating preferences) declared under Play taxonomy
- [ ] Story videos, uploaded media and government ID files/documents correctly declared
- [ ] Distinguish consent-based user-to-user live-coordinate sharing from vendor processing in Play's Sharing questions
- [ ] No public numeric trust/popularity score is claimed

---

## 4. App content declarations

- [ ] **Privacy policy** — hosted URL is public, current and NEXUS-branded
- [ ] **App access** — provide reviewer credentials and steps to reach Map / core flows
- [ ] **Ads** — verify against the exact release build; do not infer from old docs
- [ ] **Content rating** — complete the current Play questionnaire truthfully for UGC, user communication and location-aware social functionality
- [ ] **Target audience** — general Social and optional Dating 18+ are distinct; select age groups only after age-appropriate safeguards are reviewed. The incidental Dating exception requires robust feature-level age gating: https://support.google.com/googleplay/android-developer/answer/16838200
- [ ] **Product owner decision confirmed (7 Nov 2026):** no universal 18+ requirement at account creation. Keep Dating opt-in 18+ only. Do not advertise general access as 18+ or as suitable for children until minimum social age and teen safeguards are settled.
- [ ] **Reviewer evidence:** provide a social-access test account and, if Dating is enabled in the submitted build, a separate eligible-adult account to demonstrate age controls and no underage Dating exposure.
- [ ] **Social child safety:** publish child sexual abuse and exploitation prevention standards, reporting pathway and contact; assess unknown-user chat, live location and meetups before selecting any under-18 target audience groups.
- [ ] **Data Safety** — validate the matrix above against the exact release build
- [ ] **Financial features / subscriptions** — declare enabled subscription/payment behavior accurately
- [ ] **Identity verification** — ensure any ID/selfie processing disclosures match the production implementation

---

## 5. Location permission / prominent disclosure

NEXUS uses foreground location for nearby discovery and map presence. The product
must explain this before the OS permission prompt and must not imply that exact
coordinates are publicly visible.

- [ ] Confirm release manifest has no unintended background-location permission
- [ ] Prominent in-app disclosure precedes the OS location prompt
- [ ] Permission rationale is NEXUS-branded
- [ ] Denial leaves a usable privacy-safe fallback / recovery path
- [ ] No exact-coordinate value or hidden-visibility reason leaks through UI/errors

---

## 6. Privacy policy coverage

The hosted policy should accurately cover at least:

1. account/profile data;
2. precise-location processing and privacy-coarsened storage/display;
3. messages and user-generated content;
4. identity-verification data and processors when enabled;
5. diagnostics / analytics providers enabled in production;
6. subscription/payment processors when enabled;
7. retention and account deletion;
8. third-party processors;
9. privacy/support contact information.

The hosted policy page should use **NEXUS** as the visible product identity even
if its URL or infrastructure still contains a legacy `g88` identifier.

---

## 7. Store visual-system gate

Before uploading screenshots / graphics:

- [ ] no visible `G88` branding on active product surfaces;
- [ ] current Android v3 tabs are Map / Experiences / Opportunities / Connections / Identity (see `docs/IA_NAVIGATION.md`);
- [ ] people / events / listings use the current semantic marker grammar;
- [ ] verification UI is score-free;
- [ ] screenshots use the current NEXUS symbol / wordmark;
- [ ] launch material reflects the v3 eye/light-streak/spatial-handoff identity;
- [ ] screenshots are captured from the same or equivalent release candidate being submitted;
- [ ] issue #580 physical-device visual QA has no open P0/P1 blocker.

---

## 8. Pre-submit gate

- [ ] Privacy policy URL live and reachable
- [ ] Hosted policy visibly says NEXUS
- [ ] Data Safety form completed from exact release behavior
- [ ] Content rating completed
- [ ] Target audience configured
- [ ] Reviewer app-access credentials provided
- [ ] NEXUS store copy entered
- [ ] Current NEXUS graphics/screenshots uploaded
- [ ] Signed AAB uploaded to the intended closed-testing track
- [ ] Tester list / group configured
- [ ] Tester opt-in link verified
- [ ] Physical-device release QA completed

---

## 9. Account deletion — shipped in-app

Current repo documentation records the implemented path:

- **Mobile:** Settings → Delete account → confirmation flow
- **Backend:** authenticated `DELETE /users/me` cleanup path

Google Play requires a functional **external account-deletion request URL even when
in-app deletion is available**. The proposed NEXUS `/delete-account/` page is in
`docs/legal/delete-account/index.html`; verify the deployed HTTPS URL and actual
request-processing workflow, then enter it in Play Console Data Safety. Do not
regress Settings → Delete account or claim the external page is live before checking.

---

## 10. Compatibility note

The following are intentionally **not** part of this public-branding cleanup:

- `com.g88` Android package/application ID
- `@g88/*` workspace package names
- storage keys
- existing service/internal identifiers
- legacy infrastructure host names where migration would affect continuity

Those require a separate compatibility/migration plan. Public product identity
is **NEXUS** regardless of those technical identifiers.
