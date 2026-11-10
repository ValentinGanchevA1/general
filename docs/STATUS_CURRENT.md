# NEXUS — current status

> **Synced:** 2026-11-10  
> **Verified source baseline:** `master` at `38687e9815f6c0ba97e809d837e2d02e6cf432d7` (includes docs/play child-safety draft #1076 and prior group-chat work). Merged code is not evidence of deployed backend state or physical-device sign-off.  
> **Migration allocation:** inspect `apps/backend/migrations` and the CI prefix guard before allocating a number. Group-chat related migrations on disk include **0038**, **0066**, **0067**. Earlier recovery 0051 / reviews 0052 / occupation 0053 remain merged historically; deployment application is not verified by this snapshot.  
> Root `STATUS.md` is a historical progress log and may lag. This file is the live status pointer from `README.md`.  
> Early super-app MVP drafts are historical only — see `docs/HISTORICAL-SUPERAPP-PLANS.md`.

---

## 1. Product state

**NEXUS is a map-first, identity-verified, real-time social app.**

Canonical primary surfaces for mobile v3 are **Map / Experiences / Opportunities / Connections / Identity** (see `docs/IA_NAVIGATION.md`). Browser v1 still uses **Map / Discover / Pulse / Connections / You**. Nearby people, events and listings lead into lightweight interactions, 1:1 and **group** chat, friendship, attendance, stories and local trade. Launch-market context remains **Varna, BG**.

Public product identity is **NEXUS**. Compatibility identifiers such as `@g88/*`, Android package/application ID `com.g88`, storage keys and legacy infrastructure hostnames remain intentionally unchanged unless a separate compatibility migration is approved.

---

## 2. Shipped foundations on `master`

The P1–P3 mobile/backend foundations remain shipped: auth/profile, discovery, presence, waves, 1:1 chat, friends, stories/Pulse, events, marketplace/offers, verification/admin flow, dating layer, gamification/gifts, blocks and privacy-aware realtime/discovery behavior.

**P4.G group chat is shipped in code and mobile-activated** (no longer horizon).

Current high-signal slices:

| Area | State | Current contract |
|---|---|---|
| **Mobile IA / identity** | ✅ | NEXUS visual/product identity; mobile v3 Map / Experiences / Opportunities / Connections / Identity |
| **Map interaction state** | ✅ | XState pin lifecycle is canonical; legacy parallel preview/reducer paths removed (#774–#777) |
| **Discovery realtime** | ✅ | Distributed viewer-safe mutations, bounded resolver concurrency, movement/expiry lifecycle hardening; deterministic concurrency regression coverage (#783) |
| **1:1 chat** | ✅ | DM conversations, message requests, live location share (DM-only) |
| **Group chat (P4.G)** | ✅ | Normalized `conversation_members`; `kind='group'`; create/list/removeMember; Socket.IO membership fanout; mobile Groups panel + group ChatScreen; friends-only invite; block fail-closed; location/gifts disabled in group mode. PRs #931 · #936 · #938 · #940 (+ eviction hardening #1020/#1034/#1035) |
| **Error presentation** | ✅ | User-facing mobile transport/runtime errors route through the canonical sanitizer; raw transport/backend implementation strings must not reach UI (#704) |
| **Conversation refresh diagnostics** | ✅ | Refresh failures collapse into a fixed privacy-safe class/status shape; no URL, token, conversation/user id, response body or free-text diagnostic is retained (#805) |
| **Marketplace privacy** | ✅ | Bilateral block isolation covers discovery and direct listing/offer access paths |
| **Admin** | ✅ | Vite verification queue; active browser-facing identity is `NEXUS Admin` (#781) |
| **Web v1 foundation** | ✅ code foundation | Browser Map / Discover / Pulse / Connections / You, hardened HttpOnly refresh flow, same-origin edge, realtime chat and Chromium browser E2E |
| **Product analytics** | ✅ canonical pipeline | Backend/Postgres allow-listed event persistence is canonical; optional PostHog mirror is backend-only and disabled until explicitly configured/verified (#804) |
| **Migrations** | ✅ source changes | Group schema 0038/0066/0067 on disk; recovery 0051, reviews 0052, occupation 0053 historically merged; verify deployed schema separately |

This snapshot intentionally does not restate every historical feature/PR. `packages/shared` (including `groupChat.ts`), current code and focused feature docs remain the detailed contract sources.

---

## Recent merged work and remaining verification

| Area | Merged evidence | Remaining verification |
|---|---|---|
| **Group chat** | #931 create/list · #936 realtime · #938 mobile · #940 member management · #1020/#1034/#1035 room eviction | Physical-device create/send/leave/kick; Render apply of 0038/0066/0067 if not already |
| Login and password recovery | #817, #819 | Deployed mail configuration, real delivery and device recovery flow |
| Event reviews | #818, #823 | Successful backend deployment/schema application and device QA under #816 |
| Profile v3 / Interests / Purpose / occupation privacy | #821 | Device onboarding/edit/public-profile privacy regression |
| DOB picker and city autocomplete | #822, #824, #826 | Device date bounds, keyboard and manual fallback |
| Realtime chat (DM) | #810, #812 | Two-client unread/preview/read-receipt smoke |
| Direct person pin to sheet | #814 | Selection/dismiss/return-to-map device smoke |
| Radiant Orbit v6 splash | #827 | Updated physical-device motion/accessibility evidence under #669 |

Event reviews are merged, including the repeat-safe migration recovery in #823.  
Do not describe #816 as unimplemented because its device QA issue remains open.

**Doc correction (2026-11-10):** PRODUCT/ROADMAP previously listed group chat as 📋 horizon after the feature had already landed on master. That label is retired.

### Next candidate scope

RC3 remains frozen at `040f0ace62438ba0f047171fa60e6ba355ed19ca`.  
It does not certify login, profile, reviews, splash, or **group chat** changes.  
Before superseding it, select an exact commit after intended PRs pass review/CI, record the APK/build run and SHA-256, confirm backend/schema compatibility (including group membership tables), then run #580/#669 plus feature-specific checks (include group create → message → leave/kick). Capture #616 screenshots from that approved candidate. No new candidate is declared or frozen by this document.  
See `docs/EVENT_REVIEWS.md` for review-specific checks.

---

## 3. Mobile map renderer rollout

The renderer migration is **technically advanced but not activated by default**.

Merged/CI-proven:

- `@maplibre/maplibre-react-native` 11.5.0 is bundled and available (#778).
- Production MapLibre style resolution is gated behind validated MapTiler configuration; arbitrary provider/style URLs and demo fallbacks are rejected (#779).
- Android release config injection/validation is wired (#780).
- iOS React Native/CocoaPods integration, unsigned Release simulator compile and app launch are green after targeted Firebase module headers + pinned CocoaPods/Ruby + bounded pnpm-path handling (#788–#793).
- Exact build-time opt-in `NEXA_MAP_RENDERER=maplibre` is fail-closed (#794).
- CI exercises the native MapLibre view, NEXUS discovery renderer and `NexaMapRuntimeSurface` routing path (#795–#798).
- Manual real-provider canaries exist for iOS and Android (#799–#800); the current iOS canary runtime path is hardened for simulator selection, readiness timeout and diagnostics.
- Backend remote renderer policy + mobile fail-closed enforcement are merged (#801–#802).
- A read-only live policy verifier exists for the documented `false → true → false` operational proof (#803).

Still not proven by merged code alone:

1. complete the live renderer-policy `false → true → false` verification against the deployed backend;
2. run the real-provider canaries and preserve exact artifact/run evidence;
3. validate provider rendering, gestures, viewport events, lifecycle, privacy and rollback behavior on supported physical Android/iOS devices;
4. activate MapLibre only in a separate narrow production rollout after those gates are satisfied.

**Current production behavior:** renderer request remains **`legacy` by default**. Server permission cannot promote a build that did not explicitly request MapLibre. Missing/stale/malformed remote policy fails closed to legacy.

The existing discovery/H3/privacy/realtime contracts are independent of renderer choice.

---

## 4. Browser/web state

The first repo-backed NEXUS browser foundation is merged (#578). Browser-specific regression evidence includes:

- multi-tab HttpOnly refresh/Web Locks/BroadcastChannel behavior (#594);
- Socket.IO token rotation, reconnect and active-room rejoin (#595);
- stale viewport request abort/race protection (#596);
- Connections friend/wave/chat actions and message dedupe (#638);
- deployed HTTPS smoke tooling for edge/API/WebSocket/auth validation (#644).

`docs/WEB_CLIENT_V1.md` is the detailed browser implementation contract.

**Still gated before public production web release:**
1. final production web hostname/deployment policy and same-origin `/api/v1` + `/socket.io` topology;
2. supported-browser matrix beyond the current Chromium automation evidence;
3. production web map/tile stack replacing preview-only OSM standard raster tiles;
4. deployed HTTPS end-to-end validation against the final topology.

Do not treat an old PR-scoped preview as authoritative production evidence.

---

## 5. Release blockers / external gates

| Gate | State | Why it remains open |
|---|---|---|
| **#592 — dedicated NEXUS Terms of Service** | 🔴 P1 | Requires legal-reviewed Terms content and a dedicated public `/terms` document. Do not invent final legal language. |
| **#580 — physical Android release audit** | 🟡 external/device | Requires RC installation and focused QA on a real Android device, including Friends/429, privacy, accessibility, visual/interaction checks, and **group chat** smoke. |
| **#669 — launch calibration** | 🟡 external/device | Requires physical-device recordings + telemetry before changing launch timing constants. |
| **#616 — Play Store visual set** | 🟡 sequenced | Final screenshots follow physical-device sign-off; live UI evidence must come from an approved audited RC/device capture. |
| **MapLibre production activation** | 🟡 operational + device | Code/CI gates are merged; live policy proof + real-provider canary/device evidence remain before default activation. |
| **Public web release** | 🟡 product/ops | Hosting/browser/provider/deployed-E2E decisions remain explicit release gates. |

Closed/internal testing may continue where its own policy allows, but production sign-off must not bypass the legal and physical-device gates above.

---

## 6. Analytics / observability state

Canonical product analytics follow:

```text
mobile → /api/v1/analytics/events → backend allow-list → Postgres
                                              └─ optional PostHog mirror
```

The PostHog mirror (#804):

- is backend-only and best-effort;
- starts only after successful canonical persistence;
- sends only the existing HMAC subject hash, canonical event name and already-sanitized low-cardinality properties;
- does not receive raw user IDs, exact coordinates, free text, auth tokens, contact data or private entity/conversation identifiers;
- must remain disabled (`POSTHOG_ENABLED=false`) until #815 retention/personless-event deletion requirements are verified;
- #829 proposes a durable deletion pipeline but remains open; staging deletion/query verification is still required before production enablement.

Conversation refresh diagnostics (#805) use the same privacy principle: fixed classes/status only, no retained free-text transport detail.

---

## 7. Current priorities

1. **Physical-device release QA** — complete #580 and #669 without changing launch constants from subjective feel alone; include group create/send/leave/kick.
2. **Legal production gate** — obtain reviewed Terms for #592 and wire a dedicated `/terms` URL.
3. **Controlled MapLibre rollout evidence** — complete live remote-policy proof, manual provider canaries and physical-device validation before any production opt-in.
4. **Play Store visuals** — finish #616 only after the approved device baseline has no open P0/P1 release blocker.
5. **Web production topology** — choose final hostname/edge policy + production tile stack and run deployed HTTPS validation against the final topology.
6. **Analytics mirror rollout** — resolve #815 retention/account-deletion verification, review #829 and prove staging deletion before production enablement; canonical Postgres persistence stays authoritative.
7. **Ops** — confirm group-chat migrations applied on Render when exercising groups in any shared environment.

Explicitly deferred unless reprioritized: live streaming, broad microservices/Kafka/GraphQL rewrites, and speculative features not tied to the release gates above.

---

## 8. Running architecture

```text
React Native mobile ── REST + Socket.IO ──► NestJS monolith
         │                                  │
         │                                  ├─ PostgreSQL + PostGIS/H3
         │                                  ├─ Redis (presence/auth/rate/discovery coordination)
         │                                  ├─ canonical analytics persistence
         │                                  │    └─ optional backend-only PostHog mirror
         │                                  └─ media / verification integrations
         │
         └─ legacy renderer active by default
            MapLibre native/provider/runtime path available behind
            build-time opt-in + fresh remote permission + validated config

Browser web ── same-origin edge ──► /api/v1 + /socket.io ──► same backend contracts

Vite NEXUS Admin ── JWT/AdminGuard ──► verification/admin API
```

Shared DTO/socket/geo contracts live in `packages/shared` (`@g88/shared` remains the compatibility package namespace). Group contracts: `packages/shared/src/groupChat.ts`.

---

## 9. Privacy / security invariants

- Exact client GPS must not become ordinary persisted public discovery coordinates; server privacy/coarsening rules remain authoritative.
- Block/messaging/verification visibility is enforced server-side; UI state is not the security boundary.
- Group membership is authoritative only via `conversation_members`; group `participant_ids` must stay empty.
- Precise live location remains **DM-only**; group mode must not enable location sessions.
- No public numeric trust/popularity score.
- User-facing errors must not expose raw Axios/status/backend/runtime implementation strings.
- Conversation refresh diagnostics must remain fixed-class/status only; no free text, URL, token or private identifier retention.
- Browser access tokens remain memory-only; refresh credentials remain HttpOnly and are never broadcast between tabs.
- Map provider/API client configuration must be allowlisted and fail closed; do not introduce arbitrary runtime URLs as a convenience fallback.
- Remote renderer policy may only reduce capability unless the build explicitly opted into MapLibre; stale/malformed/unavailable policy resolves to legacy.
- Third-party analytics mirrors must not receive raw identity, exact location, free text, auth material or private entity identifiers; canonical backend persistence remains authoritative.
