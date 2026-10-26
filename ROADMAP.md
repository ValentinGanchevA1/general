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
| Mobile renderer migration | 🟡 controlled rollout | MapLibre capability/config gates merged; legacy renderer remains default until release/device/iOS parity |
| Browser public release | 🟡 foundation merged | Hosting/browser matrix/map provider/deployed HTTPS validation remain |

**Live migration baseline:** `0001–0050`; next free `0051` (CI prefix guard).  
**Target launch market:** **Varna, BG** (see `PRODUCT.md`).

## How to read this doc

- `docs/STATUS_CURRENT.md` is the live implementation/release snapshot.
- This file owns **sequence, gates, cuts and active risk**, not every merged PR.
- Engineering-complete does not mean production-signed-off: legal review, physical-device evidence and owner/store actions remain distinct gates.
- A bundled capability is not automatically activated. Renderer/provider changes require their own rollout gate.

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
| B2.4 Configured Android release/device smoke | ⏳ | prove packaged key/style path on release artifact/device |
| B2.5 iOS build/device parity | ⏳ | required before cross-platform default activation |
| B2.6 Controlled activation PR | ⏳ | switch `requestedRenderer` from `legacy` to `maplibre` only after prior gates; retain fail-closed fallback |

**Current production behavior:** `requestedRenderer = legacy`. Native availability is not activation.

---

## Explicit cuts / deferred architecture

Microservices-from-day-one · Kafka · GraphQL · Elasticsearch · Kubernetes · anonymous-only social · global cold-start feed as primary surface.

Do not introduce these because they are fashionable; require a measured product/load/security reason and an explicit decision.

## Risk register (active)

| ID | Risk | Mitigation / gate |
|---|---|---|
| R-Legal | Terms label does not yet have final reviewed dedicated Terms document | #592 blocks production sign-off; do not invent legal language |
| R-Device | Static CI cannot prove launch/map/accessibility/device ergonomics | #580 + #669 physical-device evidence |
| R-MapRollout | Bundled MapLibre/provider config could be mistaken for production activation | keep `legacy` default; configured release smoke + iOS parity + narrow activation PR |
| R-WebRelease | Browser foundation mistaken for production-ready web product | final hosting/browser/provider/deployed-E2E gates remain explicit |
| R-Play | Store-owner/review delay | sideload/release artifact path remains available; #616 sequences final visuals after device sign-off |
| R-Rekognition | Assist integration unavailable/misconfigured | human verification decision remains authoritative; assist-only semantics |
| R-Abuse | Spam/harassment/local discovery abuse | blocks, rate limits, strikes, server-side visibility and privacy policies remain authoritative |

## Changelog

- **2026-10-26** — Reconciled roadmap to NEXA live status: migrations `0001–0050` / next `0051`; web foundation moved from horizon to gated release track; MapLibre/MapTiler rollout gates recorded; legal + physical-device production gates made explicit.
- **2026-09-14** — P2/P3 engineering marked closed; Stories shipped; post-P3 friends/map/sheet/offers work documented.
- **2026-09-12** — P2 block/wave hardening verified.
- **2026-08–09** — Friends, Stories, profile origin, ID admin and offers moved ahead of their original placement.
