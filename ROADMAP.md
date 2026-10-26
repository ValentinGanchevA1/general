# NEXA — Roadmap

> **Authoritative source for sequence and gates.**  
> Sibling docs: `PRODUCT.md` (what/why), `SPECIFICATION.md` (contracts), `ARCHITECTURE.md` (how), `docs/STATUS_CURRENT.md` (live progress).  
> **Compatibility note:** public product identity is **NEXA**. Technical identifiers such as `@g88/*`, `com.g88`, storage keys, legacy infrastructure hostnames, release artifact names, and signing metadata remain unchanged unless an explicit migration says otherwise.  
> Last reconciled: **2026-10-26**.

---

## Status snapshot

| Phase / track | Status | Gate |
|---|---|---|
| P1 — foundation | ✅ shipped | Auth · Profile · Map Discovery · Presence · Wave · Chat |
| P2 — pre-launch hardening | ✅ engineering shipped | Production sign-off still depends on legal + physical-device + store gates |
| P3 — habit-forming features | ✅ shipped | Events · trading · friends · verification · gifts/gamification · interactions |
| P4+ product expansion | 🟡 partial | Stories shipped; web foundation merged; monetization/group chat/live streaming remain gated |
| Mobile renderer migration | 🟡 controlled rollout | Native/provider/runtime/remote-policy gates are merged; production remains `legacy` pending manual provider canaries, physical-device validation and explicit activation |
| Browser public release | 🟡 foundation merged | Hosting/browser matrix/map provider/deployed HTTPS validation remain |

**Live migration baseline:** `0001–0050`; next free `0051` (CI prefix guard).  
**Target launch market:** **Varna, BG** (see `PRODUCT.md`).

## How to read this doc

- `docs/STATUS_CURRENT.md` is the live implementation/release snapshot.
- This file owns **sequence, gates, cuts and active risk**, not every merged PR.
- Engineering-complete does not mean production-signed-off: legal review, physical-device evidence and owner/store actions remain distinct gates.
- A bundled capability, green simulator smoke or merged canary workflow is not automatically production activation.

## Phase legend

```text
🟢 done    🟡 in flight / gated    ⏳ next    📋 horizon    ❌ explicitly cut/deferred
```

## P1 — Foundation ✅

Auth · Profile · Map discovery · Presence · Wave · Chat. See `SPECIFICATION.md` for feature contracts.

## P2 — Pre-launch hardening ✅ engineering

Core engineering hardening is shipped: Sentry/PII scrubbing, chat outbox, viewport-diff discovery, blocks, module tests, abuse/privacy controls and release automation.

Production sign-off remains gated by:

1. **#580 physical Android release audit** — real-device installation, visual/interaction/privacy/accessibility smoke.
2. **#669 launch calibration** — physical-device recording + telemetry before changing launch timing constants.
3. **#592 dedicated NEXA Terms of Service** — legal-reviewed content + separate public `/terms` URL.
4. **#616 Play Store visual set** — final screenshot capture after physical-device sign-off.

Do not collapse those external/product/legal gates into “engineering done.”

## P3 — Habit-forming ✅

| Epic | Status |
|---|---|
| Gamification | ✅ |
| Gifts | ✅ |
| Push + geofences | ✅ |
| Verification visibility / admin flow | ✅ |
| Events | ✅ |
| Trending / local discovery interpretation | ✅ |
| Trading / marketplace offers + counter | ✅ |
| Friends graph | ✅ |
| Connections activity + conversations | ✅ |

## P4+ — Product expansion

| ID | Item | Status |
|---|---|---|
| P4.S | Stories / ephemeral | ✅ shipped in Pulse |
| P4.W | Browser / desktop-capable web client | 🟡 foundation merged; public release gated |
| P4.M | Monetization / premium / Connect | 📋 gated on retention + legal/payment readiness |
| P4.G | Group chat | 📋 |
| P4.L | Live streaming | ❌ deferred (infra + moderation) |
| P4.I | Geo expansion beyond current launch region | 📋 gated on launch-market evidence + abuse maturity |

### P4.W — browser release gates

The repo-backed browser foundation is merged. Chromium E2E covers multi-tab auth, realtime token rotation/room rejoin, viewport stale-response races and Connections actions/chat.

Public production web still requires:

1. final hostname/deployment policy with same-origin `/api/v1` + `/socket.io`;
2. explicit supported-browser matrix beyond Chromium automation;
3. approved production web map/tile stack instead of preview-only OSM standard raster tiles;
4. deployed HTTPS auth/REST/WebSocket smoke against the final topology.

Detailed contract: `docs/WEB_CLIENT_V1.md`.

---

## Platform rollout — mobile MapLibre

This is a controlled renderer migration, not a product-phase rewrite.

| Gate | State | Evidence / rule |
|---|---|---|
| B2.1 Native MapLibre capability bundled | ✅ | `@maplibre/maplibre-react-native` 11.5.0 available (#778) |
| B2.2 Production style/provider gate | ✅ | validated MapTiler EU/global config; no arbitrary URL/demo fallback (#779) |
| B2.3 Android release config injection/validation | ✅ code | release workflows require/validate MapTiler config (#780) |
| B2.4 iOS native dependency + compile path | ✅ CI | targeted Firebase modular headers (#788), pinned Ruby/CocoaPods (#790), bounded pnpm-path workaround (#791), unsigned Release simulator compile and launch smoke (#792–#793) |
| B2.5 iOS MapLibre runtime parity in CI | ✅ CI | native surface, NEXA discovery surface and runtime router exercised behind exact `NEXA_MAP_RENDERER=maplibre` opt-in (#794–#798) |
| B2.6 Real-provider canary infrastructure | ✅ code | manual iOS MapTiler provider canary (#799, hardened on current master) + Android provider-canary APK workflow (#800) |
| B2.7 Remote renderer kill switch | ✅ code | backend policy contract + mobile fail-closed enforcement merged (#801–#802); server `true` cannot promote a build that did not explicitly request MapLibre |
| B2.8 Live policy verification | 🟡 operational | read-only verifier merged (#803); complete documented `false → true → false` proof against deployed backend without treating it as renderer activation |
| B2.9 Manual provider/device evidence | ⏳ | run real-provider canaries and validate exact Android/iOS artifacts on supported physical devices; include gestures, viewport events, lifecycle, provider loading, privacy and rollback behavior |
| B2.10 Controlled production activation | ⏳ | only after prior gates; opt production build into `maplibre` in a separate narrow rollout with remote kill switch retained and tested rollback path |

**Current production behavior:** renderer request remains **`legacy` by default**. Native availability, provider configuration, simulator smoke, remote-policy code or a canary workflow existing in the repository is not production activation.

---

## Analytics rollout

Canonical product analytics persist through the backend/Postgres allow-listed event pipeline. A backend-only PostHog mirror is merged behind explicit configuration (#804):

- Postgres remains source of truth;
- only the existing HMAC subject hash + canonical event name + sanitized low-cardinality properties may be mirrored;
- raw user IDs, exact location, free text, auth tokens and private entity identifiers remain outside the mirror;
- keep the sink disabled until deployment configuration and controlled event-shape verification are complete.

---

## Explicit cuts / deferred architecture

Microservices-from-day-one · Kafka · GraphQL · Elasticsearch · Kubernetes · anonymous-only social · global cold-start feed as primary surface.

Do not introduce these because they are fashionable; require a measured product/load/security reason and an explicit decision.

## Risk register (active)

| ID | Risk | Mitigation / gate |
|---|---|---|
| R-Legal | Terms label does not yet have final reviewed dedicated Terms document | #592 blocks production sign-off; do not invent legal language |
| R-Device | CI/simulator evidence cannot prove final device ergonomics, launch feel or provider behavior | #580 + #669 plus MapLibre physical-device canary evidence |
| R-MapRollout | Merged MapLibre/runtime/kill-switch code could be mistaken for production activation | keep `legacy` default; require operational policy proof + manual provider/device evidence + separate activation PR |
| R-WebRelease | Browser foundation mistaken for production-ready web product | final hosting/browser/provider/deployed-E2E gates remain explicit |
| R-Analytics | Optional third-party analytics mirror expands processing surface | backend-only best-effort mirror; canonical persistence first; strict allow-list/privacy tests; disabled until configured |
| R-Play | Store-owner/review delay | sideload/release artifact path remains available; #616 sequences final visuals after device sign-off |
| R-Rekognition | Assist integration unavailable/misconfigured | human verification decision remains authoritative; assist-only semantics |
| R-Abuse | Spam/harassment/local discovery abuse | blocks, rate limits, strikes, server-side visibility and privacy policies remain authoritative |

## Changelog

- **2026-10-26** — Reconciled roadmap to current NEXA master: migrations `0001–0050` / next `0051`; web foundation remains a gated public-release track; iOS native compile/launch and MapLibre runtime-router CI gates are green; real-provider iOS/Android canary workflows and remote renderer kill-switch are merged; remaining activation work is operational policy proof + physical-device/provider evidence + a separate production opt-in. Backend-only privacy-safe PostHog mirroring is also merged behind explicit enablement.
- **2026-09-14** — P2/P3 engineering marked closed; Stories shipped; post-P3 friends/map/sheet/offers work documented.
- **2026-09-12** — P2.B1 remaining-scope cleared (wave.blocked verified).
- **2026-08–09** — Friends, Stories, profile origin, ID admin and offers moved ahead of their original placement.
