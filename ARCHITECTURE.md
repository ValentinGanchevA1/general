# G88 architecture

Living doc. Decisions here are explicit so they can be argued with. Change log at the bottom.

## 1. Goals (priority order)

1. **Discovery feels instant.** Map opens; nearby points render <500ms on a warm cache.
2. **Realtime is reliable.** Waves, presence, and chat survive flaky networks and restarts.
3. **Privacy by default.** Precise location is never exposed to other users.
4. **Cheap early, scalable later.** One Render service per role at MVP.

Anti-goal: microservices-from-day-one.

## 2. Tier map

| Tier | Component | Tech |
|------|-----------|------|
| Client | Mobile | React Native 0.83 + TS, RTK, react-native-maps |
| Client | Admin (`apps/admin`) | Vite + React + shadcn — ID queue; origin `http://127.0.0.1:5173` |
| Application | REST + realtime | NestJS 11; Socket.IO **in-process** (`/realtime`) |
| Data | Primary | Postgres 16 + PostGIS + H3-PG |
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

## 4. Module map (backend)

auth · users · discovery · presence · interactions · chat · blocks · friends · stories · listings · events · gifts · gamification · challenges · achievements · notifications · alerts · geofences · verification · id-verification · subscriptions · feed · trending · admin

## 5. Change log

- **2026-09-14** — Docs restore. Migrations 0001–0040 / next 0041. listingMode, friendsOnly, MAX_CELLS 5k, map polish Option 1, EntityBottomSheet, offers/counter, friends online privacy. Privacy invariant unchanged.
- **2026-06–08** — H3, clustering, r10 fuzz, presence-in-Redis, in-process realtime, admin app established.
