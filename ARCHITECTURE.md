# G88 Architecture

Map-first, real-time, identity-verified social + local marketplace monorepo.

## 1. Monorepo layout

| Path | Role |
|------|------|
| `apps/mobile` | React Native (TypeScript), Redux Toolkit, Socket.IO client |
| `apps/backend` | NestJS, PostGIS, Redis, Socket.IO gateway |
| `apps/admin` | Vite + React + shadcn — ID verification queue |
| `packages/shared` | DTOs, socket events, pure helpers (no UI palette) |

## 2. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Mobile | RN + TS | Strict TS, no `any` |
| API | NestJS | Modules, DTOs, guards |
| Data | Postgres 16 + PostGIS + H3-PG | |
| Data | Cache / presence | Redis 7 |
| Data | Objects | S3 presigned + buffer uploads |
| External | Push / OTP / Pay | FCM · Twilio · Stripe (test) |

## 3. Key design decisions

### 3.1 H3 for discovery

Multi-resolution H3 cells on entities; discovery picks resolution from zoom, intersects viewport, returns clusters or points.

### 3.2 Server-side clustering

Low zoom → one row per cell with counts. High zoom → individual entities.

### 3.3 Location fuzzing at write time

Stored location = H3 **r10** cell centroid (~120m). Exact GPS never lands in the DB. Exception: explicit timed **chat live-location** sessions.

### 3.4 Presence in Redis

Sorted sets by H3 r8; TTL heartbeats. Online flags gated by **friendship + `friends_see_online_status`**.

### 3.5 Realtime topology

**Today:** single process — REST + Socket.IO in `main.ts` (`/realtime`), Redis adapter ready. **Target:** split when load requires it.

### 3.6 Auth

JWT access 15m + opaque rotating refresh 30d. Google OAuth live; Apple dropped (`0019`) until iOS scope. Admin: `JwtAuthGuard` + `AdminGuard`.

### 3.7 Discovery query

`POST /discovery/nearby` — `DiscoveryQuery` with viewport, zoom, optional `kinds`, `topic`, **`listingMode`**, **`friendsOnly`**. OOM: `MAX_CELLS` **5_000**.

### 3.8 Migrations

Raw SQL. **0001–0040** on master; **next free 0041**. Dual-0030 resolved. Prefix CI guard.

### 3.9 Shared contracts

`packages/shared` is DTO/socket source of truth for mobile, backend, admin.

### 3.10 ID verification

Submit → S3 → pending. Admin decide atomic. **Rekognition assist-only.** Partial UNIQUE one pending (0034).

### 3.11 Marketplace

`mode: sell | buy`. Offers: make → counter (`lastActor`) → accept/decline. No payment v1.

### 3.12 Privacy / Sentry

Location and tokens never in Sentry. Scrubber: `packages/shared/src/scrub.ts`.

### 3.13 Theme & loading UI (mobile)

**Token ownership:** `apps/mobile/src/theme/index.ts` is the **only** brand/UI palette for the React Native app. Do not reintroduce `packages/shared` brand exports — shared stays DTOs, socket events, and pure helpers (`resolveTrustNextStep`, `strikeStanding`, scrubbers).

**Admin** (`apps/admin`) uses its own Vite/shadcn tokens; no requirement to share hex with mobile.

**Intentional non-token hex:**
- `mapStyle.ts` — Google Maps JSON style array
- `socialConfig.ts` — third-party provider brand colours

**Loading convention:**
- **Lists / grids / detail cold-start** → `Skeleton`, `SkeletonListRow`, `SkeletonMarketGrid` (`components/Skeleton.tsx`)
- **Button / toggle in-flight** → `ActivityIndicator` on the control only
- **Map first paint** → spinner or blank map is acceptable; region settle is not a skeleton surface

Migrate remaining full-screen `ActivityIndicator` placeholders **as-you-touch** (same policy as the hex cleanup). Not a sprint gate.

## 4. Module map (backend)

auth · users · discovery · presence · interactions · chat · blocks · friends · stories · listings · events · gifts · gamification · challenges · achievements · notifications · alerts · geofences · verification · id-verification · subscriptions · feed · trending · admin

## 5. Change log

- **2026-09-17** — Theme ownership (`mobile/theme` sole UI tokens); toast tints + shadowInk; loading Skeleton convention.
- **2026-09-14** — Docs restore. Migrations 0001–0040 / next 0041. listingMode, friendsOnly, MAX_CELLS 5k, map polish Option 1, EntityBottomSheet, offers/counter, friends online privacy. Privacy invariant unchanged.
- **2026-06–08** — H3, clustering, r10 fuzz, presence-in-Redis, in-process realtime, admin app established.
