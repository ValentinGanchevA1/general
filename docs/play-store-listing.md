# NEXA — Play Console Store Listing + Data Safety checklist

> Public product identity: **NEXA**. Android package/application ID remains
> `com.g88` for compatibility and must not be renamed as part of store-copy work.
> Privacy/data claims below are grounded in the current repo architecture; verify
> the final declarations against the exact release build and current Play Console
> questions before submission.

---

## 1. App details

| Field | Value |
|---|---|
| App name | `NEXA` |
| Package name | `com.g88` *(existing compatibility identifier)* |
| Default language | English (United States) |
| App or game | **App** |
| Free or paid | **Free** *(declare subscription/monetization features separately when enabled)* |
| Category | Social |
| Tags | Social, Local, Map |
| Contact email | ⟨support email⟩ |
| Website | ⟨landing page URL, optional⟩ |
| Privacy policy URL | `https://g88-legal.onrender.com/privacy` *(legacy host name; hosted page itself must be current and NEXA-branded)* |

---

## 2. Store listing copy

### App name

```text
NEXA
```

### Short description

```text
Discover people and local activity nearby on a live, privacy-aware map.
```

### Full description

```text
NEXA is a map-first social app for discovering people and local activity around
you in real time.

Open the map to explore nearby people, events and listings. Wave to someone,
connect, continue the conversation in 1:1 chat, join local events, or explore
what is happening around you through Discover and Pulse.

WHAT YOU CAN DO
• Map-first discovery — explore nearby people, events and listings
• Discover — jump into the local experiences that matter to you
• Pulse — see live local activity and signals around you
• Connections — keep relationship activity and chats together
• Waves and chat — lightweight interaction that can grow into conversation
• Events — discover, join and follow local activity
• Marketplace — explore local listings and offers
• Identity verification — manage verification signals through Trust Center
• Map presence controls — choose whether you appear in nearby discovery

BUILT FOR PRIVACY
NEXA never shows your exact coordinates to other users. Location is used to
compute nearby discovery and map presence, then privacy-coarsened before it is
stored or displayed to others. Precise GPS is not persisted in precise form.

Verification is factual and signal-based. NEXA does not expose a public numeric
trust or popularity score.

NEXA is designed around local context, direct interaction and spatial discovery
instead of a single endless global feed.

⟨Add closed-beta support contact or tester-specific note if needed.⟩
```

### Graphics checklist

- [ ] **App icon** — 512×512 current NEXA launcher artwork
- [ ] **Feature graphic** — 1024×500 NEXA-branded artwork
- [ ] **Phone screenshots** — use the current UI, not legacy G88 screens
  - [ ] Map + entity markers/sheet
  - [ ] Discover / Pulse
  - [ ] Connections
  - [ ] You / Trust Center
  - [ ] Event or Marketplace surface
- [ ] **Theme coverage** — screenshots should not mix obsolete and current visual systems
- [ ] **Promo video** — optional; if used, show the current NEXA launch/map experience

---

## 3. Data Safety working matrix

> Source of truth for location handling remains the implementation / architecture,
> not marketing copy. Current architecture documents that precise GPS is sent for
> map-position computation, immediately coarsened to roughly the H3 r10 / ~120 m
> area, and only the coarse position is stored. Other users receive only the
> privacy-coarsened position.

### 3a. Overview

| Question | Working answer |
|---|---|
| Does the app collect or share covered user data? | **Yes** |
| Is collected data encrypted in transit? | **Yes** — HTTPS/TLS; WSS for realtime |
| Is account deletion available in-app? | **Yes** — Settings → Delete account |

### 3b. Data types to validate in Play Console

| Data type | Working treatment | Purpose / note |
|---|---|---|
| **Approximate location** | Collected | Nearby discovery / map presence; privacy-coarsened position is stored |
| **Precise location** | Ephemeral processing; not persisted in precise form | Used to compute privacy-coarsened map presence |
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

### 3c. Location declaration note

Do **not** say that precise GPS “never leaves the device.” The implementation
sends precise location for nearby-position computation, then coarsens it before
persistence. Public copy should instead say:

> Exact coordinates are never shown to other users, and precise GPS is not
> persisted in precise form; NEXA stores/displays privacy-coarsened map presence.

If Play Console wording or reviewer interpretation classifies ephemeral precise
location differently, use the conservative declaration required by the current
form rather than weakening the privacy explanation.

### 3d. Security / control checks

- [x] Data encrypted in transit
- [x] In-app account deletion exists
- [ ] Public web deletion-request path / current Play requirement verified before production
- [ ] Current release build checked for analytics / diagnostics providers
- [ ] Current identity-verification processors and retention disclosed accurately
- [ ] No public numeric trust/popularity score is claimed

---

## 4. App content declarations

- [ ] **Privacy policy** — hosted URL is public, current and NEXA-branded
- [ ] **App access** — provide reviewer credentials and steps to reach Map / core flows
- [ ] **Ads** — verify against the exact release build; do not infer from old docs
- [ ] **Content rating** — complete the current Play questionnaire truthfully for UGC, user communication and location-aware social functionality
- [ ] **Target audience** — configure the intended audience explicitly; do not target children by accident
- [ ] **Data Safety** — validate the matrix above against the exact release build
- [ ] **Financial features / subscriptions** — declare enabled subscription/payment behavior accurately
- [ ] **Identity verification** — ensure any ID/selfie processing disclosures match the production implementation

---

## 5. Location permission / prominent disclosure

NEXA uses foreground location for nearby discovery and map presence. The product
must explain this before the OS permission prompt and must not imply that exact
coordinates are publicly visible.

- [ ] Confirm release manifest has no unintended background-location permission
- [ ] Prominent in-app disclosure precedes the OS location prompt
- [ ] Permission rationale is NEXA-branded
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

The hosted policy page should use **NEXA** as the visible product identity even
if its URL or infrastructure still contains a legacy `g88` identifier.

---

## 7. Store visual-system gate

Before uploading screenshots / graphics:

- [ ] no visible `G88` branding on active product surfaces;
- [ ] canonical tabs are Map / Discover / Pulse / Connections / You;
- [ ] people / events / listings use the current semantic marker grammar;
- [ ] verification UI is score-free;
- [ ] screenshots use the current NEXA symbol / wordmark;
- [ ] launch material reflects the v3 eye/light-streak/spatial-handoff identity;
- [ ] screenshots are captured from the same or equivalent release candidate being submitted;
- [ ] issue #580 physical-device visual QA has no open P0/P1 blocker.

---

## 8. Pre-submit gate

- [ ] Privacy policy URL live and reachable
- [ ] Hosted policy visibly says NEXA
- [ ] Data Safety form completed from exact release behavior
- [ ] Content rating completed
- [ ] Target audience configured
- [ ] Reviewer app-access credentials provided
- [ ] NEXA store copy entered
- [ ] Current NEXA graphics/screenshots uploaded
- [ ] Signed AAB uploaded to the intended closed-testing track
- [ ] Tester list / group configured
- [ ] Tester opt-in link verified
- [ ] Physical-device release QA completed

---

## 9. Account deletion — shipped in-app

Current repo documentation records the implemented path:

- **Mobile:** Settings → Delete account → confirmation flow
- **Backend:** authenticated `DELETE /users/me` cleanup path

Before production, verify the current Play Console requirement for an external
web deletion-request URL and provide one if required. Do not regress the in-app
flow or publish stale copy claiming that account deletion is unavailable.

---

## 10. Compatibility note

The following are intentionally **not** part of this public-branding cleanup:

- `com.g88` Android package/application ID
- `@g88/*` workspace package names
- storage keys
- existing service/internal identifiers
- legacy infrastructure host names where migration would affect continuity

Those require a separate compatibility/migration plan. Public product identity
is **NEXA** regardless of those technical identifiers.
