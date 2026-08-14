# G88 — Project Instructions

> Repo: `C:\\Users\\vganc\\g88`
> Canonical codebase: `apps/` (monorepo). Anything under `legacy/` is read-only reference.

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
- **Code in TypeScript.** Both mobile and backend.
- **Snippets are minimal but realistic** — copy-pasteable starting points, not aspirational pseudo-code.
- **Offer 2–3 strong options** when a decision is non-obvious. Recommend one with rationale.

## Product Context

G88 is a **map-first, location-based social platform**. Users appear as interactive avatars on a real-time map. Shipped P1 surface: nearby people · presence · lightweight interactions (wave, chat). P3+ surface includes events, listings/trades, gifts, gamification, stories, and progressive verification. Long-term: hyperlocal commerce, reputation, monetization.

**Privacy is a hard constraint**: exact GPS never lands in the DB. Locations are fuzzed at write time to H3 r10 cell centroid (~120m). See `ARCHITECTURE.md §3.3`.

## Phase Scope (where we are)

Authoritative sequence + gates: `ROADMAP.md`. Live progress: `STATUS.md`.

- **P1 — foundation: ✅ shipped.** Auth → Profile → Map discovery → Presence → Wave → Chat.
- **P2 — pre-launch hardening: 🟢 gate list complete.** Sentry, chat outbox, viewport-diff, per-module specs, synthetic soak. **Beta path = Android-first** (Play closed testing); iOS deferred.
- **P3 — habit-forming: 🟢 largely surfaced.** Gamification, gifts, events, trading, push/geofences, verification visibility — see `STATUS.md`.
- **P4+ — horizon.** Monetization, group chat, web client — don't build without explicit go-ahead.

## Current Stack (in use)

| Layer                      | Tech |
|----------------------------|------|
| Monorepo / tooling         | pnpm 11 workspaces (`apps/*`, `packages/*`). TypeScript 5.5. Node ≥22.13. |
| Mobile                     | React Native 0.83 (CLI), React 19, RTK 2, React Navigation 7 |
| Admin dashboard            | Vite + React 19 + shadcn/ui + TanStack Query + Socket.IO (`apps/admin`). Origin **`http://127.0.0.1:5173`** (must be in `CORS_ORIGINS`). ID-verification queue. |
| Backend (REST)             | NestJS 11, TypeORM 0.3 (DataSource only, raw SQL), Node ≥22.13 |
| Realtime gateway           | Socket.IO 4 (Redis adapter), **in-process** with REST (`ARCHITECTURE.md §3.5`) |
| Database                   | PostgreSQL 16 + PostGIS + H3-PG. Migrations through **0031**; next free **0032** |
| Cache / Presence / Pub-Sub | Redis 7 |
| Storage                    | AWS S3 (presigned + buffer uploads) |
| Auth                       | JWT access 15m + opaque rotating refresh 30d. Google OAuth live; Apple removed (`0019`) |
| Payments                   | Stripe subscriptions (test mode); Connect deferred |
| Verification               | Twilio phone OTP. ID-document — wired (`0020`/`0021`/`0027`/`0028`): user submit → S3; **assist-only AWS Rekognition**; **human decide** via `apps/admin` (`AdminGuard`). No auto `pending→verified`. |
| Push                       | FCM |
| Observability              | Sentry (shared PII scrubber). Structured request logging deferred (C3) |
| Deploy                     | Render `g88-api` + `g88-redis`; Supabase Postgres; GitHub Actions CI |

## Repo Layout

```
g88/
├── apps/
│   ├── backend/            NestJS REST API + in-process Socket.IO realtime gateway
│   │   ├── src/modules/    Feature modules (auth, users, discovery, chat, messaging,
│   │   │                     interactions, presence, notifications, alerts, geofences, social,
│   │   │                     verification, id-verification, subscriptions, gamification,
│   │   │                     challenges, achievements, gifts, trending, feed, blocks, stories, ...)
│   │   ├── src/realtime/   Socket.IO gateway (top-level, not under modules/)
│   │   └── migrations/     0001–0031 raw SQL (next free 0032)
│   ├── mobile/             React Native + TypeScript client (src/features/{domain}/)
│   └── admin/              Vite + React admin dashboard (ID-verification queue)
│       ├── src/features/   auth (LoginPage, useAuth) · verification (QueuePage, table, modal, socket)
│       ├── src/lib/        api-client (axios + adminToken) · auth-storage (localStorage)
│       └── vite.config.ts  host 127.0.0.1:5173 strictPort
├── packages/
│   └── shared/             API DTOs, socket event shapes, geo helpers — mobile + backend + admin
├── legacy/                 Read-only. Pre-monorepo flat layout. CI ignores. Never import.
├── docs/marketing/         Pitch artifacts — never an engineering source
├── ARCHITECTURE.md         System design, decisions, rationale (+ change log)
├── ROADMAP.md              Authoritative phase sequence, gates, risk register, cuts list
├── STATUS.md               Live phase progress + reconciliation
├── DEPLOY.md               Render/Supabase config, env vars, migration + credential status
├── README.md               Quick start, dev commands
├── pnpm-workspace.yaml     Workspace definition
└── docker-compose.yml      Local Postgres + Redis
```

**Key URLs:**
- Local backend: `http://10.0.2.2:3001/api/v1` (Android emulator) or `http://localhost:3001/api/v1`
- Local realtime: `ws://localhost:3001/realtime`
- **Admin local:** `http://127.0.0.1:5173` (`pnpm --filter @g88/admin dev`) — **must** be listed in backend `CORS_ORIGINS` (`localhost` ≠ `127.0.0.1`)
- Prod: `https://api.g88.app/api/v1` / `https://g88-api.onrender.com`
- Swagger: `/api/docs` (local dev only)

## Where to Find Authoritative Info

| Question | Source |
|----------|--------|
| System design, decisions | `ARCHITECTURE.md` |
| What's shipping / blocked | `STATUS.md` |
| Schema | `apps/backend/migrations/` |
| API + socket contracts | `packages/shared/src/` |
| Quick start | `README.md` |

## Important Conventions

### Backend (`apps/backend/`)

- **TypeORM is wired but used only for `DataSource.query()`** — raw parameterized SQL. No entities, no `Repository<T>`.
- **Path alias `@/` → `src/`**.
- **Single `main.ts`**: Socket.IO gateway runs **in-process** with REST (namespace `/realtime`).
- **Errors** → `{ statusCode, code, message, details? }` via `AllExceptionsFilter`.
- **DTO validation**: `ValidationPipe(whitelist, transform, forbidNonWhitelisted)`.
- **Rate limiting**: global throttler + per-route overrides; auth often `@SkipThrottle()`.

### Realtime (`apps/backend/src/realtime/`)

- **Namespace:** `/realtime`.
- **Auth handshake:** function-form `auth: async (cb) => cb({ token })`.
- **Rooms:** `user:{userId}`, `cell:{h3r8}`, `convo:{conversationId}`, plus event rooms as needed.
- **Typed contracts** in `@g88/shared/events`.

### Mobile (`apps/mobile/`)

- **Path alias `@/` → `src/`.** Absolute imports.
- **State:** Redux Toolkit; tokens in OS secure store (`react-native-keychain`).
- **Networking:** single Axios instance; single-flight refresh.
- **Sockets:** module-level singleton in `useSocket.ts`.

### Admin (`apps/admin/`)

- **Fourth workspace app** — not a separate backend. Same `g88-api` REST + `/realtime` as mobile (`ARCHITECTURE.md §3.14`).
- **Auth:** `POST /auth/login` → localStorage keys `adminToken` / `adminRefreshToken` / `adminUser`. On 401: refresh then `clearSession`. User must be in backend `ADMIN_USER_IDS`.
- **Guards:** admin routes use class-level `JwtAuthGuard` + `AdminGuard` (`GET/POST /api/v1/admin/verifications/pending*`).
- **Queue UX:** React Query prefix `['verifications','pending']`; invalidate by prefix after decide. Live updates via `useVerificationSocket` when logged in.
- **Dev origin:** Vite binds **`127.0.0.1:5173`** (`strictPort`). Put both `http://127.0.0.1:5173` and `http://localhost:5173` in `CORS_ORIGINS`.
- **Scope today:** ID-verification review only (side-by-side selfie/ID, Rekognition assist score, approve/reject). Expand carefully — keep AdminGuard on every new route.

### Shared (`packages/shared/`)

- **Single source of truth for API + socket contracts.** Mobile, backend, and admin consume `@g88/shared`.
- **Geo helpers** (`fuzzLocation`, `h3ResolutionForZoom`, `cellsForViewport`) live here, not duplicated.

## Output Constraints

- **Headings + step structure.** No prose blobs.
- **For each major section:** short explanation → concrete decisions → minimal code.
- **No vague statements.** Challenge first, code second.

---

## Reconciliation State

Old flat layout is under `legacy/` (read-only). **Do not import from `legacy/`** — CI enforces this.

---

# Codebase Reference

> Documents the **actual** `apps/` monorepo state. **Authority order:** `ARCHITECTURE.md` → `STATUS.md` → `SPECIFICATION.md` → `ROADMAP.md` → this section.

## Quick facts

- **Node** `>=22.13` (CI `.nvmrc` = `22`). **pnpm 11**. **TypeScript 5.5**.
- **Prod API:** `https://api.g88.app/api/v1` / `https://g88-api.onrender.com`. Realtime namespace `/realtime`.
- **Admin local:** `http://127.0.0.1:5173`.
- **Path alias `@/` → `src/`** on mobile and backend.

---

## Mobile (`apps/mobile/`)

**Stack:** React Native 0.83 · React 19 · RTK 2 · React Navigation 7.

### Layout (`src/`)

```
api/        client.ts · tokenStore.ts (Keychain)
components/ ErrorBoundary · map markers · ContextualFab · ...
features/   auth · chat · discovery · gamification · gifts · location · profile · pulse · verification · stories · ...
navigation/ AppNavigator.tsx
realtime/   useSocket.ts
screens/    Auth · Map · Profile* · Chat · Pulse · Marketplace · Events · ...
store/      index.ts
```

### Conventions

Typed `useAppDispatch` / `useAppSelector`. No `any`. Tokens encrypted at rest.

---

## Admin (`apps/admin/`)

**Stack:** Vite 6 · React 19 · TypeScript 5.5 · TanStack Query 5 · Socket.IO client · shadcn/ui · Tailwind · `@g88/shared`.

**Purpose:** operator-facing **ID-verification review queue**. Same REST + realtime backend as mobile; no dedicated admin API service.

### Layout (`src/`)

```
features/auth/            LoginPage · useAuth · api
features/verification/    QueuePage hooks · VerificationTable · VerificationDetailModal · useVerificationSocket · query-keys
lib/                      api-client.ts (axios + Bearer adminToken) · auth-storage.ts
layout/                   AdminLayout · Sidebar
pages/                    QueuePage (primary) · DashboardPage (stub)
```

### Auth & CORS

1. Login with a normal user account whose UUID is listed in **`ADMIN_USER_IDS`**.
2. Tokens stored in **localStorage** (`adminToken`, `adminRefreshToken`, `adminUser`) — browser-only; acceptable for internal ops tool, not for end-user mobile.
3. Vite **host `127.0.0.1:5173`**, `strictPort: true`. Backend `CORS_ORIGINS` must include that origin (and optionally `localhost:5173`).

### Backend routes (admin)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/admin/verifications/pending` | Queue list |
| GET | `/admin/verifications/pending/:userId` | Detail + presigned media + assist scores |
| POST | `/admin/verifications/pending/:userId/decide` | `{ decision, reason? }` — atomic pending→verified/rejected |

All class-guarded: `JwtAuthGuard` + `AdminGuard`. Rekognition scores are **assist-only** (`ARCHITECTURE.md §3.12`).

---

## Backend (`apps/backend/`)

**Stack:** NestJS 11 · TypeORM 0.3 (**`DataSource.query()` only**) · PostgreSQL 16 + PostGIS + H3-PG · Redis 7 · Socket.IO 4.

### Database

Migrations **0001–0031** (next **0032**), tracked in `schema_migrations`. Runner is idempotent; `RENAMES` handle renumbered files. Locations fuzzed to H3 r10 at write time.

### Auth chain

`Bearer` → `JwtAuthGuard` → `@CurrentUser()`. Admin routes add `AdminGuard`. WebSocket auth verified in `handleConnection`.

---

## Shared (`packages/shared/`)

API DTOs, socket contracts, geo helpers — **mobile + backend + admin** import `@g88/shared`.

---

## Privacy invariants (non-negotiable)

1. Exact GPS never lands in the DB — fuzzed to H3 r10 centroid at write time (except explicit timed chat live-location sessions).
2. Location + tokens must never appear in Sentry payloads.

## Explicitly deferred

Stripe Connect / paid gifts · Elasticsearch · Kafka · gRPC · Kubernetes · GraphQL · live streaming · group chat · web/desktop client. (Most are on the `ROADMAP.md` cuts list.)
