# NEXA — current status

> **Synced:** 2026-10-26  
> **HEAD truth:** `master` through admin identity merge **#781** (`7046586b`) and deterministic discovery-concurrency test **#783**.  
> **Database migrations:** unique prefixes **0001–0050**; next free **0051** (CI migration-prefix guard).  
> Root `STATUS.md` is a historical progress log and may lag. This file is the live status pointer from `README.md`.

---

## 1. Product state

**NEXA is a map-first, identity-verified, real-time social app.**

Canonical primary surfaces are **Map / Discover / Pulse / Connections / You**. Nearby people, events and listings lead into lightweight interactions, chat, friendship, attendance, stories and local trade. Launch-market context remains **Varna, BG**.

Public product identity is **NEXA**. Compatibility identifiers such as `@g88/*`, Android package/application ID `com.g88`, storage keys and legacy infrastructure hostnames remain intentionally unchanged unless a separate compatibility migration is approved.

---

## 2. Shipped foundations on `master`

The existing P1–P3 mobile/backend foundations remain shipped: auth/profile, discovery, presence, waves, 1:1 chat, friends, stories/Pulse, events, marketplace/offers, verification/admin flow, dating layer, gamification/gifts, blocks and privacy-aware realtime/discovery behavior.

Current high-signal slices:

| Area | State | Current contract |
|---|---|---|
| **Mobile IA / identity** | ✅ | NEXA visual/product identity; Map / Discover / Pulse / Connections / You |
| **Map interaction state** | ✅ | XState pin lifecycle is canonical; legacy parallel `showPreview`/reducer paths removed (#774–#777) |
| **Discovery realtime** | ✅ | Distributed viewer-safe mutations, bounded resolver concurrency, movement/expiry lifecycle hardening; deterministic concurrency regression test (#783) |
| **Error presentation** | ✅ | User-facing mobile transport/runtime errors route through canonical sanitizer; Redux + alert regression coverage (#704) |
| **Marketplace privacy** | ✅ | Bilateral block isolation covers discovery and direct listing/offer access paths |
| **Admin** | ✅ | Vite verification queue; active browser-facing identity is `NEXA Admin` (#781) |
| **Web v1 foundation** | ✅ code foundation | Browser Map / Discover / Pulse / Connections / You, hardened HttpOnly refresh flow, same-origin edge, realtime chat and real-browser Chromium E2E |
| **Migrations** | ✅ | `0001–0050`; next free `0051` |

This snapshot intentionally does not restate every historical feature/PR. `packages/shared`, current code and focused feature docs remain the detailed contract sources.

---

## 3. Mobile map renderer rollout

The renderer migration is **capability-complete but not activated by default**:

- `@maplibre/maplibre-react-native` 11.5.0 is bundled and marked available (#778).
- Production MapLibre style resolution is gated behind validated MapTiler configuration; arbitrary provider/style URLs and demo-tile fallback are not accepted (#779).
- Android release workflows validate/inject `NEXA_MAPTILER_API_KEY` plus allowlisted map ID/region configuration (#780).
- `requestedRenderer` remains **`legacy`**. Availability is not activation.
- Controlled MapLibre activation remains gated on configured release/device validation and iOS build/device parity. Do not flip the default renderer solely because the native module is present.

The existing discovery/H3/privacy/realtime contracts are independent of renderer choice.

---

## 4. Browser/web state

The first repo-backed NEXA browser foundation is merged (#578). Browser-specific regression evidence includes:

- multi-tab HttpOnly refresh/Web Locks/BroadcastChannel behavior (#594);
- Socket.IO token rotation, reconnect and active-room rejoin (#595);
- stale viewport request abort/race protection (#596);
- Connections friend/wave/chat actions and message dedupe (#638);
- manual deployed HTTPS smoke tooling for edge/API/WebSocket/auth validation (#644).

`docs/WEB_CLIENT_V1.md` is the detailed browser implementation contract.

**Still gated before public production web release:**
1. final production web hostname/deployment policy and same-origin `/api/v1` + `/socket.io` topology;
2. supported-browser matrix beyond the current Chromium automation evidence;
3. production web map/tile stack replacing preview-only OSM standard raster tiles;
4. deployed HTTPS end-to-end validation against the final topology.

Do not treat the old PR-scoped preview as authoritative production evidence.

---

## 5. Release blockers / external gates

| Gate | State | Why it remains open |
|---|---|---|
| **#592 — dedicated NEXA Terms of Service** | 🔴 P1 | Requires legal-reviewed Terms content and a dedicated public `/terms` document. Do not invent final legal language. |
| **#580 — physical Android release audit** | 🟡 external/device | Requires installation and focused QA on a real Android device, including privacy/error-copy/accessibility checks. |
| **#669 — launch calibration** | 🟡 external/device | Requires physical-device recordings + telemetry before changing launch timing constants. |
| **#616 — Play Store visual set** | 🟡 sequenced | Final screenshot capture follows physical-device sign-off; do not generate fake live UI evidence. |
| **MapLibre activation** | 🟡 engineering + device | Provider gate is merged; configured release smoke and iOS parity remain before default activation. |
| **Public web release** | 🟡 product/ops | Hosting/browser/provider/deployed-E2E decisions remain explicit release gates. |

Closed/internal testing may continue where its own policy allows, but production sign-off must not bypass the legal and physical-device gates above.

---

## 6. Current priorities

1. **Physical-device release QA** — complete #580 and #669 without changing constants from subjective feel alone.
2. **Legal production gate** — obtain reviewed Terms for #592 and wire a dedicated `/terms` URL.
3. **Controlled map renderer rollout** — validate configured Android release behavior, establish iOS parity, then activate MapLibre in a separate narrow PR with fallback retained.
4. **Web production topology** — choose final hostname/edge policy + production tile stack and run the deployed HTTPS smoke contract.
5. **Authority-doc reconciliation** — update older `PRODUCT.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `SPECIFICATION.md`, `CLAUDE.md` prose only where current code/merged PRs can prove the replacement fact; preserve historical references and compatibility identifiers.

Explicitly deferred unless reprioritized: live streaming, broad microservices/Kafka/GraphQL rewrites, and speculative features that are not tied to the release gates above.

---

## 7. Running architecture

```text
React Native mobile ── REST + Socket.IO ──► NestJS monolith
         │                                  │
         │                                  ├─ PostgreSQL + PostGIS/H3
         │                                  ├─ Redis (presence/auth/rate/discovery coordination)
         │                                  └─ media / verification integrations
         │
         └─ legacy map renderer active by default
            MapLibre native capability bundled; MapTiler-configured activation gated

Browser web ── same-origin edge ──► /api/v1 + /socket.io ──► same backend contracts

Vite NEXA Admin ── JWT/AdminGuard ──► verification/admin API
```

Shared DTO/socket/geo contracts live in `packages/shared` (`@g88/shared` remains the compatibility package namespace).

---

## 8. Privacy / security invariants

- Exact client GPS must not become ordinary persisted public discovery coordinates; server privacy/coarsening rules remain authoritative.
- Block/messaging/verification visibility is enforced server-side; UI state is not the security boundary.
- No public numeric trust/popularity score.
- User-facing errors must not expose raw Axios/status/backend/runtime implementation strings.
- Browser access tokens remain memory-only; refresh credentials remain HttpOnly and are never broadcast between tabs.
- Map provider/API client configuration must be allowlisted and fail closed; do not introduce arbitrary runtime URLs as a convenience fallback.
