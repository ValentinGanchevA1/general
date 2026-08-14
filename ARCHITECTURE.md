# G88 architecture

Living doc. Decisions in here are explicit so they can be argued with. If you change one, update the section and add a dated note at the bottom.

## 1. Goals (in priority order)

1. **Discovery feels instant.** Map opens, nearby points are rendered in <500ms on a warm cache.
2. **Realtime is reliable.** Waves, presence, and chat survive flaky mobile networks and process restarts.
3. **Privacy by default.** A user's precise location is never exposed to other users. Period.
4. **Cheap to run early, scalable when it matters.** One Render service per role at MVP; add replicas before sharding.

Anti-goal: micro-services-from-day-one. Two deployable units (REST API, Realtime gateway) is the maximum until we have load that justifies more.

## 2. Tier map

| Tier        | Component                 | Tech                                              |
|-------------|---------------------------|---------------------------------------------------|
| Client      | Mobile                    | React Native + TypeScript, RTK, react-native-maps |
| Client      | Admin dashboard (`apps/admin`) | Vite + React + shadcn/ui — ID-verification queue, live socket feed; origin `http://127.0.0.1:5173` |
| Edge        | TLS + LB                  | Render-provided (or Cloudflare in front)          |
| Application | REST API                  | NestJS, TypeORM                                   |
| Application | Realtime gateway          | Socket.IO with Redis adapter                      |
| Data        | Primary store             | Postgres 16 + PostGIS + H3-PG                     |
| Data        | Cache / presence / pubsub | Redis 7                                           |
| Data        | Object storage            | S3 (or Cloudflare R2) with presigned URLs         |
| External    | Push                      | FCM (Android + iOS via APNs proxy)                |
| External    | Payments                  | Stripe                                            |
| External    | Comms                     | Twilio (OTP), SendGrid (transactional)            |

## 3. Key design decisions

### 3.14 Admin dashboard — separate client, shared backend contract

`apps/admin` (Vite + React + shadcn/ui) is a fourth workspace app. It talks to the same `g88-api` REST + Socket.IO surface as mobile (no separate backend), authenticates via `AdminGuard`-protected routes (`ADMIN_USER_IDS` allow-list), and gets live queue updates over the existing realtime gateway rather than polling. Dev server binds **`127.0.0.1:5173`** (`strictPort`) — that origin must appear in `CORS_ORIGINS` (`localhost` ≠ `127.0.0.1`). Tokens live in browser localStorage (`adminToken` / `adminRefreshToken` / `adminUser`). Today it's a single feature (ID-verification review queue); expand only behind the same AdminGuard.

> Full ARCHITECTURE.md body retained on branch via sequential update — see companion CLAUDE.md commit for operator instructions.
