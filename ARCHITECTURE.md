# NEXA Architecture

Map-first, real-time, identity-verified social + local marketplace monorepo.

> **Compatibility note:** public product identity is **NEXA**. Technical identifiers such as `@g88/*`, `com.g88`, storage keys, legacy infrastructure hostnames, release artifact names, and signing metadata remain unchanged unless an explicit migration says otherwise.  
> **Live implementation/release state:** `docs/STATUS_CURRENT.md`. This file owns durable architecture, not per-PR progress.

## 1. Monorepo layout

| Path | Role |
|------|------|
| `apps/mobile` | React Native (TypeScript), Redux Toolkit, Socket.IO client |
| `apps/backend` | NestJS, PostGIS/H3, Redis, Socket.IO gateway |
| `apps/admin` | Vite + React + shadcn — verification/admin surfaces |
| `packages/shared` | DTOs, socket events, geo/security helpers; no UI palette |
| `web` | Browser client + same-origin edge runtime for `/api/v1` and `/socket.io` |

## 2. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Mobile | React Native CLI + strict TypeScript | Redux Toolkit; legacy map renderer remains production default while MapLibre is gated |
| Browser | TypeScript + bundled web client | Same-origin edge; memory-only access token + HttpOnly refresh cookie |
| API | NestJS | Modules, DTOs, guards, public runtime-config boundary |
| Data | PostgreSQL 16 + PostGIS + H3-PG | Canonical durable application + analytics data |
| Cache / coordination | Redis 7 | Presence, auth/rate/discovery coordination and bounded ephemeral state |
| Objects | S3 | Presigned + buffer upload paths where applicable |
| Realtime | Socket.IO | `/realtime`; chat, presence, verification and interaction events |
| External | FCM · Twilio · Stripe (test) · Rekognition assist | Human verification decisions remain authoritative |
| Optional analytics mirror | PostHog Capture API | Backend-only, best-effort, disabled until configured; Postgres remains canonical |

## 3. Key design decisions

### 3.1 H3 for discovery

Multi-resolution H3 cells on entities; discovery picks resolution from zoom, intersects viewport, returns clusters or points.

### 3.2 Server-side clustering

Low zoom → one row per cell with counts. High zoom → individual entities. Clients render the authoritative discovery result rather than independently redefining cluster semantics.

### 3.3 Location fuzzing at write time

Stored ordinary discovery location = H3 **r10** cell centroid (~120m). Exact GPS must not become normal persisted public discovery coordinates. Exception: explicit timed **chat live-location** sessions, which have their own bounded privacy contract.

### 3.4 Presence in Redis

Sorted sets by H3 r8; TTL heartbeats. Online flags are gated by **friendship + `friends_see_online_status`**.

### 3.5 Realtime topology

REST and Socket.IO currently share the NestJS application boundary; realtime namespace is `/realtime`. Redis participates in shared coordination. Split services only when measured load/operational evidence justifies it; do not introduce microservices/Kafka as speculative architecture.

### 3.6 Auth

Mobile/API auth uses JWT access + rotating refresh-family semantics. Google OAuth is supported. Apple Sign-In remains a separate product/auth scope decision; current iOS build/runtime work does not implicitly enable it.

Password recovery uses an 8-digit email code (15-minute lifetime, 5 guesses,
60-second resend cooldown, 5 requests per hour per email HMAC). Challenges and an
AES-GCM encrypted mail outbox are stored in PostgreSQL; API workers use leased
`SKIP LOCKED` claims to deliver through SendGrid with at most 3 attempts. Reset
atomically changes the bcrypt hash, increments `auth_version`, revokes refresh
tokens and consumes the challenge. Refresh issuance locks the user version to
prevent in-flight authentication from recreating a pre-reset refresh session.
Already-issued access tokens retain their existing 15-minute expiry. See
`docs/PASSWORD_RECOVERY.md` for configuration and QA.

Browser auth has a distinct hardened boundary:

- access token is memory-only;
- rotating refresh credential is HttpOnly / SameSite cookie-scoped to browser auth paths;
- browser auth mutations require the expected origin/session header contract;
- same-origin edge proxies `/api/v1` and `/socket.io` to the backend;
- multi-tab coordination signals session changes without broadcasting credentials.

Admin uses authenticated admin guards; browser-facing identity is NEXA Admin.

### 3.7 Discovery query

`POST /discovery/nearby` — `DiscoveryQuery` with viewport, zoom, optional `kinds`, `topic`, `listingMode`, `friendsOnly`. OOM protection includes `MAX_CELLS` **5_000**. Viewport/realtime visibility rules remain server-authoritative.

### 3.8 Migrations

Raw SQL migrations. **0001–0052** are allocated on current master; **next free 0053**. CI enforces unique numeric prefixes.

### 3.9 Shared contracts

`packages/shared` is the field-level DTO/socket/geo source of truth across mobile, backend, admin and browser surfaces. Compatibility package namespace remains `@g88/shared`.

### 3.10 ID verification

Submit → object storage → pending → admin decision. Rekognition is **assist-only**; a human/admin decision is authoritative. Partial UNIQUE one-pending constraint remains part of the persisted workflow.

### 3.11 Marketplace

`mode: sell | buy`. Offers support make → counter (`lastActor`) → accept/decline/withdraw. No payment settlement is implied by the v1 offer contract.

### 3.12 Privacy / Sentry / diagnostics

Location and tokens must never enter Sentry payloads. Shared scrubber lives in `packages/shared/src/scrub.ts`.

User-facing transport/backend errors are sanitized before presentation. Structured diagnostics should retain bounded classes/status only where possible; conversation-refresh diagnostics intentionally exclude free text, URLs, tokens and private user/conversation identifiers.

### 3.13 Theme & loading UI (mobile)

**Token ownership:** `apps/mobile/src/theme/index.ts` is the **only** brand/UI palette for the React Native app. Do not reintroduce `packages/shared` brand exports — shared remains contracts and pure helpers.

**Admin** uses its own Vite/shadcn tokens; browser/admin are not required to share mobile hex values.

**Intentional non-token hex:**
- `mapStyle.ts` — legacy map JSON style array
- `socialConfig.ts` — third-party provider brand colours

**Loading convention:**
- lists / grids / detail cold-start → Skeleton variants;
- button / toggle in-flight → control-local `ActivityIndicator`;
- map first paint may use map-specific loading behavior rather than a generic list skeleton.

### 3.14 Mobile renderer boundary

MapLibre is a controlled capability, not the current production default.

Effective MapLibre selection requires all of:

1. build requests exact `NEXA_MAP_RENDERER=maplibre`;
2. a fresh, valid remote renderer policy permits MapLibre;
3. native MapLibre is available;
4. validated MapTiler provider configuration is ready.

Any missing, stale, malformed or unavailable condition resolves to the **legacy** renderer. Server permission alone cannot promote a build compiled/requesting legacy. Manual provider canaries and physical-device evidence remain release gates before production activation.

### 3.15 Browser edge boundary

The browser client is repo-backed and uses a secretless same-origin edge runtime:

```text
browser ──► same-origin edge ──► /api/v1 + /socket.io ──► NestJS backend
```

The edge has a fixed backend origin, does not accept user-controlled proxy targets, forwards browser origin for backend validation, and exists to preserve same-origin cookie/WebSocket behavior. Production hostname/provider policy remains an operational release decision.

### 3.16 Product analytics boundary

Canonical analytics flow:

```text
client event ──► backend allow-list ──► Postgres
                                  └──► optional PostHog mirror
```

PostHog delivery is backend-only, best-effort and may occur only after canonical persistence. Mirror payloads are restricted to the existing HMAC subject hash, canonical event name and sanitized low-cardinality properties; raw user IDs, exact location, free text, auth material and private entity identifiers stay outside the mirror.

## 4. Module map (backend)

auth · users · discovery · presence · interactions · chat · blocks · friends · stories · listings · events · gifts · gamification · challenges · achievements · notifications · alerts · geofences · verification · id-verification · subscriptions · feed · trending · admin · runtime-config · analytics

## 5. Change log

- **2026-10-26** — Reconciled current architecture: migrations `0001–0050` / next `0051`; repo-backed browser edge/auth boundary; controlled MapLibre selection + remote kill switch; backend-first canonical analytics with optional privacy-safe PostHog mirror; privacy-safe conversation diagnostics.
- **2026-09-29** — ProfileView A–D; EntityBottomSheet trust/stats/identity; migrations through 0046; next free 0047.
- **2026-09-17** — Theme ownership (`mobile/theme` sole UI tokens); toast tints + shadowInk; loading Skeleton convention.
- **2026-09-14** — Docs restore. listingMode, friendsOnly, MAX_CELLS 5k, map polish Option 1, EntityBottomSheet, offers/counter, friends online privacy. Privacy invariant unchanged.
- **2026-06–08** — H3, clustering, r10 fuzz, presence-in-Redis, in-process realtime, admin app established.
