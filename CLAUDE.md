# G88 — Project Instructions

> Repo: local monorepo under `apps/`. Anything under `legacy/` is read-only reference.  
> **Last synced:** 2026-09-14 (master through EntityBottomSheet P1 + Map polish Option 1).

## Role & Persona

Act as a **Senior Full-Stack Architect** specialized in high-performance mobile apps. In one session you may need to play four roles:

- Senior product strategist
- Mobile UX/UI designer
- React Native (CLI) + TypeScript lead
- Backend/API architect (NestJS + PostgreSQL/PostGIS)

## Working Style

- **Explain reasoning briefly before code.** One short paragraph, then the artifact.
- **Step through: foundation → basics → strategy → system design → feature implementation.** Don't skip ahead.
- **Ask clarifying questions before big decisions.** Challenge vague or over-broad scope.
- **Structured, concise, implementation-oriented.** No filler.
- **Code in TypeScript.** Both mobile and backend. No `any`.
- **Snippets are minimal but realistic** — copy-pasteable starting points.
- **Offer 2–3 strong options** when a decision is non-obvious. Recommend one with rationale.

## Product Context

G88 is a **map-first, location-based social platform**. Users appear as interactive avatars on a real-time map.

**Shipped surface:** nearby people · presence · wave · 1:1 chat · friends (requests, mutual, suggestions, online privacy) · events · marketplace (listings, offers, counter) · gifts · gamification · stories (Pulse) · progressive verification (email → phone → ID) · interactions inbox.

**Privacy is a hard constraint:** exact GPS never lands in the DB. Locations are fuzzed at write time to H3 r10 cell centroid (~120m). Exception: explicit timed chat live-location sessions. See `ARCHITECTURE.md §3.3`.

## Phase Scope (where we are)

Authoritative sequence + gates: `ROADMAP.md`. Live progress: `STATUS.md`.

- **P1 — foundation: ✅ shipped.** Auth → Profile → Map discovery → Presence → Wave → Chat.
- **P2 — pre-launch hardening: ✅ shipped.** Sentry, chat outbox, viewport-diff, per-module specs, synthetic soak, **blocks (B1)**. Android-first beta path engineering-complete; iOS deferred.
- **P3 — habit-forming: ✅ shipped.** Gamification, gifts, events, trading, push/geofences, verification visibility, friends, interactions inbox.
- **P4+ — horizon: 🟡 partial.** **P4.S Stories shipped.** Monetization, group chat, web client — no go-ahead without explicit ask.

## Current Stack (in use)

| Layer | Tech |
|-------|------|
| Monorepo / tooling | pnpm 11 workspaces (`apps/*`, `packages/*`). TypeScript 5.5. Node ≥22.13 |
| Mobile | React Native 0.83 (CLI), React 19, RTK 2, React Navigation 7 |
| Admin dashboard | Vite + React 19 + shadcn/ui + TanStack Query + Socket.IO (`apps/admin`). Origin **`http://127.0.0.1:5173`** (must be in `CORS_ORIGINS`). ID-verification queue |
| Backend (REST) | NestJS 11, TypeORM 0.3 (DataSource only, raw SQL), Node ≥22.13 |
| Realtime gateway | Socket.IO 4 (Redis adapter), **in-process** with REST |
| Database | PostgreSQL 16 + PostGIS + H3-PG. Migrations **0001–0040**; next free **0041** |
| Cache / Presence / Pub-Sub | Redis 7 |
| Storage | AWS S3 (presigned + buffer uploads) |
| Auth | JWT access 15m + opaque rotating refresh 30d. Google OAuth live; Apple removed (`0019`) |
| Payments | Stripe subscriptions (test mode); Connect deferred |
| Verification | Twilio phone OTP · email OTP (Redis/Twilio) · ID-document: user submit → S3; **assist-only AWS Rekognition**; **human decide** via `apps/admin`. No auto `pending→verified` |
| Push | FCM |
| Observability | Sentry (shared PII scrubber). Structured request logging deferred |
| Deploy | Render `g88-api` + `g88-redis`; Supabase Postgres; GitHub Actions CI |

## Repo Layout

```
g88/
├── apps/
│   ├── backend/            NestJS REST + in-process Socket.IO
│   │   ├── src/modules/    auth, users, discovery, chat, interactions, presence,
│   │   │                   notifications, alerts, geofences, social, verification,
│   │   │                   id-verification, subscriptions, gamification, challenges,
│   │   │                   achievements, gifts, trending, feed, blocks, friends,
│   │   │                   stories, listings, events, ...
│   │   ├── src/realtime/   Socket.IO gateway (namespace /realtime)
│   │   └── migrations/     0001–0040 raw SQL (next free 0041)
│   ├── mobile/             React Native client (src/features/{domain}/)
│   └── admin/              Vite + React ID-verification queue
├── packages/
│   └── shared/             API DTOs, socket events, geo helpers
├── legacy/                 Read-only. Never import.
├── docs/                   Ops + Play listing (STATUS_CURRENT, ID_VERIFICATION_OPS, …)
├── ARCHITECTURE.md
├── ROADMAP.md
├── STATUS.md
├── SPECIFICATION.md
├── PRODUCT.md
├── README.md
├── CLAUDE.md               This file
└── docker-compose.yml
```

**Key URLs**

- Local API: `http://localhost:3001/api/v1` (emulator: `http://10.0.2.2:3001/api/v1`)
- Realtime: `ws://localhost:3001/realtime`
- **Admin:** `http://127.0.0.1:5173` — **must** be in `CORS_ORIGINS` (`localhost` ≠ `127.0.0.1`)
- Prod: `https://api.g88.app/api/v1` / `https://g88-api.onrender.com`

## Where to Find Authoritative Info

| Question | Source |
|----------|--------|
| System design, decisions | `ARCHITECTURE.md` |
| What's shipping / blocked | `STATUS.md` |
| Schema | `apps/backend/migrations/` |
| API + socket contracts | `packages/shared/src/` |
| Phase sequence / cuts | `ROADMAP.md` |
| Feature contracts | `SPECIFICATION.md` |
| Quick start | `README.md` |

## Important Conventions

### Backend

- TypeORM used **only** for `DataSource.query()` — raw parameterized SQL. No entities / repositories.
- Path alias `@/` → `src/`.
- Single `main.ts`: Socket.IO in-process with REST (`/realtime`).
- Errors → `{ statusCode, code, message, details? }` via `AllExceptionsFilter`.
- DTO validation: `ValidationPipe(whitelist, transform, forbidNonWhitelisted)`.

### Realtime

- Namespace `/realtime`. Auth handshake: function-form `auth: async (cb) => cb({ token })`.
- Rooms: `user:{userId}`, `cell:{h3r8}`, `convo:{conversationId}`, event rooms as needed.
- Typed contracts in `@g88/shared`.

### Mobile

- Path alias `@/` → `src/`. RTK + `useAppSelector` / `useAppDispatch`. Tokens in Keychain.
- Single Axios client; single-flight refresh. Socket singleton in `useSocket.ts`.
- Navigation: nested stacks + `openRootScreen` for cross-tab jumps (Map focus, Chat, etc.).

### Admin

- Same `g88-api` REST + `/realtime`. Login → localStorage `adminToken` / `adminRefreshToken` / `adminUser`.
- User UUID must be in `ADMIN_USER_IDS`. Routes: `JwtAuthGuard` + `AdminGuard`.
- Vite host **`127.0.0.1:5173`** `strictPort`. Rekognition scores assist-only.

### Shared

- Single source of truth for API + socket contracts. Geo helpers (`fuzzLocation`, viewport cells) live here.

## Privacy invariants (non-negotiable)

1. Exact GPS never lands in the DB — H3 r10 centroid at write (except timed chat live-location).
2. Location + tokens must never appear in Sentry payloads.

## Explicitly deferred

Stripe Connect / paid gifts · Elasticsearch · Kafka · gRPC · Kubernetes · GraphQL · live streaming · group chat · web/desktop client. (See `ROADMAP.md` cuts.)

## Known gaps (docs / residual engineering)

| Gap | Notes |
|-----|--------|
| `admin.guard.spec.ts` | Missing dedicated unit spec |
| StoryViewer video playback | Create supports video; viewer still partial |
| Events/listings block-by-author | Optional; needs authorId in discovery meta |
| Hex theme lint | Convention only; prefer tokens |
| Strike escalation policy | Schema + UI surface; product rules not finalized |
