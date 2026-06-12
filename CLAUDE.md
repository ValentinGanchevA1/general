# G88 — Project Instructions

> Repo: `C:\Users\vganc\g88`
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

G88 is a **map-first, location-based social platform**. Users appear as interactive avatars on a real-time map. Shipped P1 surface: nearby people · presence · lightweight interactions (wave, chat). P3 surface (backend built, mobile not yet woven in): events · listings/trades · gifts · gamification · trending. Long-term: hyperlocal commerce, reputation, monetization.

**Privacy is a hard constraint**: exact GPS never lands in the DB. Locations are fuzzed at write time to H3 r10 cell centroid (~120m). See `ARCHITECTURE.md §3.3`.

## Phase Scope (where we are)

Authoritative sequence + gates: `ROADMAP.md`. Live progress: `STATUS.md`.

- **P1 — foundation: ✅ shipped.** Auth → Profile → Map discovery → Presence → Wave → Chat.
- **P2 — pre-launch hardening: 🟢 gate list complete (2026-06-11).** All gates done: Sentry ✅, dev-secret cleanup ✅, chat outbox (C6) ✅, viewport-diff map protocol (M1) ✅, ≥1 `.spec.ts` per backend module (C2) ✅; 7-day synthetic soak cleared. **Beta path = Android-first (Google Play closed testing); iOS/TestFlight deferred** — the `ios/` native project doesn't exist yet and archiving needs macOS. Android release signing + signed-AAB CI (`android-release.yml`) are in-repo; remaining is owner-side Play Console setup (see `DEPLOY.md` → "Mobile release"). See `STATUS.md`.
- **P3 — habit-forming features: ⏳ post-launch.** Backend for gamification, challenges, gifts, achievements, notifications/geofences, trending, social-linking, and trades **already exists in the repo** but is largely **not surfaced** in mobile. Don't treat a P3 module's existence as "done" — surfacing is the remaining work.
- **P4+ — horizon: 📋 documented only.** Monetization (Stripe Connect, paid gifts), live streaming, group chat, web client. Don't build without explicit go-ahead — see the `ROADMAP.md` cuts list.

## Current Stack (in use)

| Layer                      | Tech                                                                                                                                                                                                                                                                                                                                    |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Monorepo / tooling         | pnpm 11 workspaces (`apps/*`, `packages/*`). TypeScript 5.5 across all packages. Node ≥22.13.                                                                                                                                                                                                                                           |
| Mobile                     | React Native 0.83 (CLI), React 19, TypeScript 5.5, Redux Toolkit 2, React Navigation 7                                                                                                                                                                                                                                                  |
| Backend (REST)             | NestJS 11, TypeORM 0.3 (DataSource only, raw SQL), TypeScript 5.5, Node ≥22.13                                                                                                                                                                                                                                                          |
| Realtime gateway           | NestJS, Socket.IO 4 (Redis adapter). Runs **in-process** with REST in a single `main.ts` / single `g88-api` service; separate deploy is planned, not built (`ARCHITECTURE.md §3.5`)                                                                                                                                                     |
| Database                   | PostgreSQL 16 + PostGIS + H3-PG (`geography(Point,4326)` + H3 cell columns r5/7/9/10, GIST indexes). Schema = migrations `0001`–`0024`, next free `0025`                                                                                                                                                                                |
| Cache / Presence / Pub-Sub | Redis 7 (sorted sets per H3 r8 cell, 120s TTL)                                                                                                                                                                                                                                                                                          |
| Spatial index              | H3 (Uber hexagonal hierarchical), server-side clustering at zoom <14                                                                                                                                                                                                                                                                    |
| Storage                    | AWS S3, presigned URLs (avatars + photo gallery; verified end-to-end)                                                                                                                                                                                                                                                                   |
| Auth                       | JWT access 15m + refresh 30d, **rotating opaque DB-stored refresh tokens, family tracking + revocation (shipped)**. Google OAuth live; Apple Sign-In removed (migration `0019`)                                                                                                                                                         |
| Payments                   | Stripe **subscriptions** (Checkout + Billing portal + webhook) — wired, **test mode**, tier set only by verified webhook. Connect/marketplace deferred to P4                                                                                                                                                                            |
| Verification               | Twilio Verify (phone OTP) — wired. ID-document verification (selfie + ID photo → S3 presigned upload, status `none/pending/verified/rejected`, verified badge on profile + map) — wired, **manual review** (`0020`/`0021`); no `pending→verified` automation yet. Automated face-compare (AWS Rekognition) still deferred (not in code) |
| Push                       | Firebase Cloud Messaging (Android + iOS via APNs proxy)                                                                                                                                                                                                                                                                                 |
| Observability              | Sentry on both apps (errors, PII-scrubbed). Structured request logging (Pino) still deferred — debt **C3**                                                                                                                                                                                                                              |
| Deploy                     | Render: `g88-api` (REST + in-process realtime) + `g88-redis`. **Supabase** managed Postgres. GitHub Actions CI                                                                                                                                                                                                                          |

## Deferred Stack (not yet adopted)

Reference these only when proposing post-launch work. **Do not introduce without discussion.** Most are on the `ROADMAP.md` cuts list — they keep resurfacing from legacy roadmaps; the answer is "not now."

- Payments: Stripe **Connect** (marketplace fees on trades) + paid gifts — P4 monetization, gated on retention
- Search: Elasticsearch (Postgres FTS + Redis sorted sets cover current search/trending)
- Streaming: Kafka / RabbitMQ event bus (NestJS events + Redis pub/sub suffice)
- Observability: Prometheus + Grafana / Loki, structured Pino logs (Sentry is the v1 surface — **already shipped on both apps**)
- RPC: gRPC for internal service-to-service (single backend service today)
- Orchestration: Kubernetes, Terraform on AWS (Render is sufficient ≤100k DAU)
- Time-series: InfluxDB (no time-series workload exists)
- API gateway: GraphQL (REST + WS is shipping; a switch would be a mid-flight rewrite)
- Email: SendGrid transactional email — referenced in older docs, **not wired in code**

> **Debt C3** is now narrowed: Sentry (errors) ships on both apps; the remaining gap is **structured request logging** (Pino → Loki/Grafana), deferred until log volume warrants it.

## Repo Layout

```
g88/
├── apps/
│   ├── backend/            NestJS REST API + in-process Socket.IO realtime gateway
│   │   ├── src/modules/    Feature modules (auth, users, discovery, chat, messaging,
│   │   │                     interactions, presence, notifications, alerts, geofences, social,
│   │   │                     verification, id-verification, subscriptions, gamification,
│   │   │                     challenges, achievements, gifts, trending, feed, ...)
│   │   ├── src/realtime/   Socket.IO gateway (top-level, not under modules/)
│   │   └── migrations/     0001–0024 raw SQL (next free 0025)
│   └── mobile/             React Native + TypeScript client (src/features/{domain}/)
├── packages/
│   └── shared/             API DTOs, socket event shapes, geo helpers — both apps import this
├── legacy/                 Read-only. Pre-monorepo flat layout. CI ignores. Never import.
├── docs/marketing/         Pitch artifacts (bestRecentMVP.html) — never an engineering source
├── ARCHITECTURE.md         System design, decisions, rationale (+ change log)
├── ROADMAP.md              Authoritative phase sequence, gates, risk register, cuts list
├── SPECIFICATION.md        Per-feature contracts (referenced by ROADMAP)
├── PRODUCT.md              What/why, target users, scope, monetization
├── STATUS.md               Live phase progress (P1 shipped, P2 active) + reconciliation
├── DEPLOY.md               Render/Supabase config, env vars, migration + credential status
├── AUDIT.md                Latest codebase audit snapshot
├── AGENTS.md               Agent/tooling notes
├── README.md               Quick start, dev commands
├── pnpm-workspace.yaml     Workspace definition
└── docker-compose.yml      Local Postgres + Redis
```

**Key URLs:**
- Local backend: `http://10.0.2.2:3001/api/v1` (Android emulator) or `http://localhost:3001/api/v1`
- Local realtime: `ws://localhost:3001/realtime` (Socket.IO is attached to the REST HTTP server, same port)
- Prod: `https://api.g88.app/api/v1`
- Swagger: `/api/docs` (local dev only)

## Where to Find Authoritative Info

| Question                                                | Source                                                       |
|---------------------------------------------------------|--------------------------------------------------------------|
| System design, decisions, "why is it like this?"        | `ARCHITECTURE.md`                                            |
| Current P1 pillar progress, what's blocked, what's next | `STATUS.md`                                                  |
| Database schema                                         | `apps/backend/migrations/0001_initial.sql`                   |
| API DTOs and socket event contracts                     | `packages/shared/src/`                                       |
| Quick start, dev commands                               | `README.md`                                                  |
| Tech debt backlog (legacy ranking still applies)        | `TECH_DEBT_AUDIT.md`                                         |
| Product roadmap (post-P1)                               | `PRODUCT.md`                                                 |
| Marketing/vision deck                                   | `docs/marketing/bestRecentMVP.html` (not engineering source) |

## Important Conventions

### Backend (`apps/backend/`)

- **TypeORM is wired but used only for `DataSource.query()`** — raw parameterized SQL. No entities, no `Repository<T>`. This is intentional: the schema uses H3 generated columns and materialized views that don't map cleanly to TypeORM.
- **Path alias `@/` → `src/`** (via `tsconfig-paths` + Jest `moduleNameMapper`).
- **Single `main.ts`**: the Socket.IO gateway (`RealtimeModule`) is imported into `AppModule` and runs **in-process** with REST — Socket.IO attaches to the same HTTP server (port 3001, namespace `/realtime`). The two-service split (a separate `main.realtime.ts` + Render service) is the planned topology in `ARCHITECTURE.md §3.5`, not the current reality.
- **All errors normalize to `{ statusCode, code, message, details? }`** via `AllExceptionsFilter`. The `code` is machine-readable (`'wave.cooldown'`), `message` is human-readable.
- **DTO validation**: `ValidationPipe(whitelist, transform, forbidNonWhitelisted)`. Class-validator decorators on every DTO.
- **Rate limiting**: 3 tiers via `@nestjs/throttler`. Auth endpoints `@SkipThrottle()`; sensitive write endpoints get tighter `@Throttle()` overrides.

### Realtime (`apps/backend/src/realtime/`)

- **Namespace:** `/realtime` (not `/chat`). One namespace for all socket traffic.
- **Auth handshake:** function-form `auth: async (cb) => cb({ token })` so reconnects re-read the latest access token.
- **Rooms:**
  - `user:{userId}` — direct fan-out (waves, conversation:opened)
  - `cell:{h3r8}` — presence delta fan-out
  - `convo:{conversationId}` — chat message fan-out
- **Typed contracts:** `ClientToServerEvents` + `ServerToClientEvents` in `@g88/shared/events`. Adding an untyped event is a compile error.

### Mobile (`apps/mobile/`)

- **Path alias `@/` → `src/`.** All imports are absolute (`@/api/client`, `@/realtime/useSocket`).
- **State:** Redux Toolkit. Slices live in `src/features/{domain}/`. Persisted: `auth` only.
- **Networking:** single Axios instance in `src/api/client.ts`. Single-flight refresh, no thundering herd.
- **Sockets:** module-level singleton in `src/realtime/useSocket.ts`. Survives across screens. Disconnected only on logout.
- **Logging:** `console.*` is currently permitted (tech debt **C3** — see `STATUS.md`). The target is a `logger` from `@/utils/logger` that no-ops in production builds; until that shim lands, don't add new `console.*` in hot paths. New code should prefer the eventual `logger` boundary.

### Shared (`packages/shared/`)

- **Single source of truth for API + socket contracts.** Both apps consume `@g88/shared`.
- **Geo helpers** (`fuzzLocation`, `h3ResolutionForZoom`, `cellsForViewport`) live here, not duplicated.

## Output Constraints

- **Headings + step structure.** No prose blobs.
- **For each major section:** short explanation → concrete decisions → minimal code (frontend + backend where relevant).
- **No long essays.** Architecture, flows, code.
- **No vague statements.** "Improve performance" is not actionable. "Add a 60s Redis cache on `GET /users/:id`" is.
- **Challenge first, code second.** If the requested approach is wrong, say so before producing the wrong thing.

---

## Reconciliation State

This repo recently consolidated two parallel codebases (`apps/mobile` + `apps/backend` flat layout) into the current `g88/` monorepo. The old code is preserved under `legacy/` as read-only reference. **Do not import from `legacy/`** — CI lint rule enforces this.

For the status of each P1 pillar and which legacy modules have been reconciled, see `STATUS.md`.

---

# Codebase Reference

> Documents the **actual** `apps/` monorepo state (verified against source). Update when architecture changes.
> **Authority order:** `ARCHITECTURE.md` → `STATUS.md` → `SPECIFICATION.md` → `ROADMAP.md` → this section.
> `docs/marketing/bestRecentMVP.html` is **not** engineering authority. Anything under `legacy/` describes the pre-reconciliation flat layout and must not be used as a reference for current code.

## Quick facts

- **Node** `>=22.13` (CI pins via `.nvmrc` = `22`). **pnpm 11** workspaces (`apps/*`, `packages/*`). **TypeScript 5.5** everywhere.
- **Prod API:** `https://api.g88.app/api/v1` (Render `g88-api`, also `https://g88-api.onrender.com`). **Realtime:** same host+port, namespace `/realtime`.
- **Local backend:** `http://10.0.2.2:3001/api/v1` (Android emulator) · `http://localhost:3001/api/v1` (iOS sim/desktop). Swagger `/api/docs` (dev only).
- **Path alias `@/` → `src/`** on **both** apps (mobile uses absolute `@/...` imports — *not* relative).

---

## Mobile (`apps/mobile/`)

**Stack:** React Native 0.83 (CLI) · React 19 · TypeScript 5.5 · Redux Toolkit 2 · React Navigation 7. New Architecture enabled.

> ⚠️ RN 0.83 + React 19 is bleeding-edge — vet every native dep before adding (a native module needs an Android rebuild, not just a Metro reload).

### Layout (`src/`)

```
api/        client.ts (axios singleton) · tokenStore.ts (AsyncStorage tokens)
components/ ErrorBoundary · map markers (EntityMarker) · ContextualFab · ...
features/   auth · chat · discovery · gamification · gifts · location · profile · pulse · verification
hooks/      redux.ts (useAppDispatch/useAppSelector)
lib/        analytics.ts (track() shim)
navigation/ AppNavigator.tsx (RootStackParamList + auth gate + bottom tabs)
realtime/   useSocket.ts (module-singleton Socket.IO client)
screens/    Auth · Map · Profile{,Creation,Edit} · Photos · Chat · Subscription · Verification ·
            VerificationId · SocialLinking · Achievements · Leaderboard · Challenges · GiftsInbox · AlertComposer · ...
store/      index.ts (configureStore)
utils/      ·  config.ts (build-time env)  ·  env.d.ts
```

### State — `store/index.ts`

- **5 reducers:** `auth · profile · chat · pulse · discovery`.
- **No `redux-persist`.** Slices start empty each launch. Auth survives restart because **tokens live in `AsyncStorage`** (`tokenStore`, keys `g88:access_token` / `g88:refresh_token`) and `authSlice.restoreSession` rehydrates on boot.
- ⚠️ Tokens are **unencrypted** AsyncStorage — pre-TestFlight hardening item.
- Always use typed `useAppDispatch` / `useAppSelector` (`src/hooks/redux.ts`), never raw RTK hooks.

### Networking — `api/client.ts`

- Single axios instance, `baseURL = ${Config.API_BASE_URL}/api/v1`, timeout **15 s**.
- Request interceptor injects `Authorization: Bearer <accessToken>` from `tokenStore`.
- On **401** (non-auth route): single-flight refresh via `POST /auth/refresh { refreshToken }` → retry once; refresh failure → `tokenStore.clear()` + `authEvents.emit('logout')`. `authEvents` (in `client.ts`) **is** the cross-module bus — there is no separate `eventBus`.
- Errors normalized to `{ statusCode, code, message, details? }` (mirrors backend `AllExceptionsFilter`).

### Realtime — `realtime/useSocket.ts`

- **Module-level singleton** socket → `${API_BASE_URL}/realtime`, `transports: ['websocket']`. Survives navigation; torn down only by `disconnectSocket()` on logout.
- **Function-form auth:** `auth: async (cb) => cb({ token: <fresh access token> })` so reconnects re-read the latest token.
- Reconnect 500 ms → 5 s; resumes on `AppState` `active`; **drains the chat outbox on every `connect`**.
- Fully typed against `@g88/shared` `ServerToClientEvents` / `ClientToServerEvents`; sends use ack promises (`chat:send`, `presence:update`, `conversation:join`).

### Config — `config.ts`

`API_BASE_URL` resolves: prod build → `https://g88-api.onrender.com`; dev → `10.0.2.2:3001` (Android) / `localhost:3001` (iOS) / LAN IP / full `https://` remote host. `GOOGLE_WEB_CLIENT_ID`, `SENTRY_DSN`. Env vars are inlined at bundle time (babel transform); set in `apps/mobile/.env` (gitignored, see `.env.example`).

### Navigation / auth gate — `AppNavigator.tsx`

`RootStackParamList` is declared here — **register new screens here first.** Gate: `restoreSession` (spinner) → unauthenticated ⇒ `Auth` only → authenticated but profile incomplete ⇒ `ProfileCreation` → else `Main` (Map · Pulse · Profile tabs) + full stack.

### Conventions

`console.*` is still permitted (debt **C3**) — prefer the eventual `@/utils/logger` boundary; don't add `console.*` in hot paths. No `any`. PascalCase screens/components, camelCase slices/hooks.

---

## Backend (`apps/backend/`)

**Stack:** NestJS 11 · TypeORM 0.3 (**`DataSource.query()` only — no entities, no repositories**) · PostgreSQL 16 + PostGIS + H3-PG · Redis 7 · Socket.IO 4 · TS 5.5 · Node ≥22.13.

### Layout (`src/`)

```
main.ts                      bootstrap (see below)
app.module.ts                composes 22 feature modules + RealtimeModule + Throttler APP_GUARD
common/  s3.service.ts        S3 presigned URLs (avatar, photos, verification)
         all-exceptions.filter.ts   → { statusCode, code, message, details? }
config/  redis.module.ts      (TypeOrmModule.forRootAsync lives inline in app.module)
modules/ <22 feature modules> (table below)
realtime/ realtime.gateway.ts · realtime.module.ts · ws-jwt.guard.ts · realtime.dto.ts
migrations/ 0001–0024 raw SQL (next free 0025)
```

### `main.ts` cross-cutting

| Concern | Implementation |
|---|---|
| Port / prefix | `PORT` (def 3001), global prefix `api/v1` |
| Security | `helmet()`; CORS origins from `CORS_ORIGINS` (comma-split) |
| Body | `rawBody: true` (Stripe webhook signature); JSON limit **15 mb** (base64 photo upload) |
| Validation | `ValidationPipe({ whitelist, transform, forbidNonWhitelisted })` |
| Errors | `AllExceptionsFilter` → `{ statusCode, code, message, details? }` |
| Rate limit | `ThrottlerModule` single global tier **120 req / 60 s** (`APP_GUARD`); per-endpoint `@Throttle()` / `@SkipThrottle()` overrides (auth routes skip) |
| Observability | `@sentry/nestjs`, `sendDefaultPii: false`, 10 % traces in prod |
| Fail-fast | `JWT_SECRET` ≥32 chars (≥64 in prod); `DATABASE_URL` required in prod |

### 22 feature modules (`src/modules/`)

| Module | Route prefix | Responsibility |
|---|---|---|
| `auth` | `/auth` | Email/pw + Google OAuth; opaque DB-stored rotating refresh tokens (family + revocation) |
| `users` | `/users` | Profile read/update, avatar + photo gallery (presigned S3 + base64), ID-verification status field |
| `discovery` | `/discovery` | Map-nearby query (H3 + viewport-diff), server-side clustering |
| `presence` | — (socket) | Redis presence ZSETs; driven by `presence:update` event (no REST controller) |
| `interactions` | `/interactions` | Waves (send → match ladder) |
| `chat` | `/conversations*` | Conversation list + message history (persisted) |
| `messaging` | `/conversations` | `POST` — message-permission gate (match ∨ interest overlap), pending message requests |
| `notifications` | `/notifications` | FCM device-token registration + send-on-offline |
| `alerts` | `/alerts` | Geo alert posts (feed source) |
| `geofences` | `/geofences` | Geofence create + active list; geofence-triggered pushes |
| `feed` | `/feed` | Pulse activity aggregation (chats + waves + alerts) |
| `trending` | `/trending` | Nearby trending (Redis 5-min cache) |
| `gamification` | `/gamification` | XP ledger, levels, streak, leaderboard |
| `challenges` | `/challenges` | Daily challenges (`GET /today`) |
| `achievements` | `/achievements` | Achievement catalog + unlock state |
| `gifts` | `/gifts` | XP-funded gifts: catalog/balance/received/send (dual-balance wallet) |
| `verification` | `/verification` | Twilio phone OTP (`/phone/start`, `/phone/check`) |
| `id-verification` | `/verification/id` | ID-document upload (selfie + ID → S3), manual review (`/start`, `/submit`, `/status`) |
| `subscriptions` | `/subscriptions` | Stripe checkout + portal + signature-verified webhook → `subscription_tier` |
| `social` | `/social` | Provider-generic OAuth account linking (HMAC-signed state) |
| `events` | `/events` | P3.5 events: create + nearby + detail · RSVP (capacity-gated) · polls (vote tally) · Q&A (upvotes). Shipped + prod-verified (backend + mobile) |
| `listings` | `/listings` | P3.7 trading: listing create + browse grid + detail · offers (upsert; seller accept/decline → marks sold) · favorites (toggle). Offer-based v1, **no payment processing** (Stripe Connect P4). Shipped (backend + mobile: Marketplace/ListingDetail/ListingCreate) |

### Auth chain

`Bearer` → `JwtAuthGuard` → `@CurrentUser()` → handler. Refresh tokens: **access 15 m, refresh 30 d**, opaque + DB-stored + rotating (single-use; replay revokes the family). Google OAuth verified server-side. **WebSocket** auth: token verified directly in `handleConnection` (guards don't fire on lifecycle hooks) via `ws-jwt.guard` logic.

### Realtime gateway (`src/realtime/`)

- **One namespace `/realtime`.** Rooms: `user:{userId}` (direct fan-out), `cell:{h3r8}` (presence deltas), `convo:{conversationId}` (chat).
- Contracts in `@g88/shared/events` — adding an untyped event is a compile error.
  - **Server→Client:** `wave:received` · `presence:delta` · `chat:message` · `conversation:opened` · `gift:received` · `error:event`.
  - **Client→Server (ack’d):** `presence:update` · `conversation:join` · `chat:typing` · `chat:send`.

### Database

Raw parameterized SQL via `DataSource.query()` (no ORM entities — schema uses H3 generated columns + materialized views that don't map cleanly). Migrations `0001`–`0024` (next `0025`), tracked in `schema_migrations` by filename; runner is idempotent (skips applied). `0001`–`0015` use guarded DDL; **`0020` is not idempotent — already applied, do not re-run.** Locations fuzzed to **H3 r10 centroid at write time** (privacy invariant). H3 cell columns r5/7/9/10 + PostGIS `geography(Point,4326)` + GIST indexes; `v_discoverable_entity` view feeds the map.

---

## Shared (`packages/shared/`)

Single source of truth for API DTOs, socket contracts, and geo helpers — both apps import `@g88/shared`. Files: `api.ts` (includes ID-verification DTOs + `IdVerificationStatus`), `events.ts` (socket types), `geo.ts` (`fuzzLocation`, `h3ResolutionForZoom`, `cellsForViewport`), plus `activity.ts`, `achievements.ts`, `challenges.ts`, `gamification.ts`, `gifts.ts`. CI builds `packages/shared/dist` **before** backend/mobile typecheck+jest (they resolve the built output). No central brand/theme token file exists — UI colors are inline per component.

---

## Key API endpoints

All under `/api/v1`. JWT unless noted.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` · `/auth/login` | No | |
| POST | `/auth/refresh` | No | opaque refresh, rotates on use |
| POST | `/auth/logout` | JWT | revokes refresh family |
| POST | `/auth/oauth/google` | No | Google ID token |
| GET | `/auth/me` | JWT | |
| GET | `/users/me` · `/users/me/profile` · `/users/:id` | JWT | |
| PATCH | `/users/me/profile` | JWT | |
| POST | `/users/me/avatar/presigned-url` · `/users/me/photos/presigned-url` · `/users/me/photos` · `/users/me/photos/base64` | JWT | S3 upload flow |
| PATCH/DELETE | `/users/me/photos/order` · `/users/me/photos/:photoId` | JWT | gallery (6 cap, position-0 = avatar) |
| POST | `/discovery/nearby` | JWT | viewport-diff capable |
| POST | `/interactions/wave` | JWT | |
| GET | `/conversations` · `/conversations/:id/messages` | JWT | history |
| POST | `/conversations` | JWT | create/request (permission-gated) |
| GET | `/feed` · `/trending/nearby` · `/challenges/today` | JWT | |
| GET | `/gamification/me` · `/gamification/leaderboard` · `/achievements` | JWT | |
| POST | `/gamification/ping` | JWT | |
| GET | `/gifts/catalog` · `/gifts/balance` · `/gifts/received` | JWT | |
| POST | `/gifts/send` | JWT | atomic wallet debit |
| POST | `/notifications/device-token` | JWT | FCM register |
| POST | `/alerts` · `/geofences` | JWT | |
| GET | `/geofences/me/active` | JWT | |
| POST | `/verification/phone/start` · `/verification/phone/check` | JWT | Twilio OTP |
| POST | `/verification/id/start` · `/verification/id/submit` · GET `/verification/id/status` | JWT | manual review |
| POST | `/subscriptions/checkout` · `/subscriptions/portal` | JWT | Stripe hosted |
| POST | `/subscriptions/webhook` | No | Stripe signature-verified |
| GET | `/social/:provider/start` · `/social/callback` · DELETE `/social/:provider` | JWT* | OAuth linking |
| POST | `/events` · `/events/nearby` | JWT | create event · "events near you" |
| GET | `/events/:id` · `/events/:id/polls` · `/events/:id/questions` | JWT | detail · polls · Q&A |
| PUT | `/events/:id/rsvp` · `/events/polls/:pollId/vote` · `/events/questions/:questionId/upvote` | JWT | RSVP · vote · upvote |
| POST | `/events/:id/polls` · `/events/:id/questions` | JWT | host poll · ask question |
| POST | `/listings` · `/listings/browse` · `/listings/:id/offers` | JWT | create · browse grid · make offer |
| GET | `/listings/:id` · `/listings/:id/offers` · `/listings/favorites` | JWT | detail · offers · saved |
| PUT | `/listings/:id/status` · `/listings/:id/favorite` · `/listings/:id/offer/withdraw` · `/listings/offers/:offerId` | JWT | mark sold · save · withdraw · accept/decline |

## Realtime data-flow examples

- **Wave:** `POST /interactions/wave` → insert + `server.to('user:{recipientId}').emit('wave:received', …)` → recipient `useSocket` handler dispatches into Redux; FCM fallback if no live socket.
- **Chat send:** `chat:send` ack → server persists message → echoes ack to sender + `server.to('convo:{id}').emit('chat:message', …)`. Sent while disconnected ⇒ queued in `chatSlice.outbox`, drained on next socket `connect`.
- **Presence:** `presence:update` → fuzz to H3 r10 → Redis ZSET (r8 cell) → `presence:delta` fan-out to `cell:{h3r8}` on cell-boundary crossing.

---

## CI/CD (`.github/workflows/`)

- **`ci.yml`** — triggers: push `master` / `claude/**`, PR → `master`. Jobs: **`no-legacy-imports`** (blocks `legacy/` imports) · **`backend`** (install → build shared → `eslint --max-warnings 0` → typecheck → `jest --ci --runInBand` → `nest build`) · **`mobile`** (… → `jest --ci`). Node from `.nvmrc`. **Lint + typecheck are blocking** (not advisory).
- Other workflows: `android-build.yml` (AAB + Maps key injection), `codeql.yml`, `synthetic-monitor.yml` (cron `*/5`, login→discovery→wave→chat against prod), `summary.yml`, `npm-publish-github-packages.yml`.
- **Deploy:** Render `g88-api` (REST + in-process realtime) + `g88-redis` (Frankfurt). **Supabase** managed Postgres (`DATABASE_URL`). Secrets set on the `g88-api` dashboard. No `render.yaml` in the repo. See `DEPLOY.md`.

---

## External integrations

| Service | Status | Entry point |
|---|---|---|
| AWS S3 | ✅ wired + verified (bucket `g88-uploads-dev`, eu-north-1) | `common/s3.service.ts` |
| Google OAuth | ✅ live | `modules/auth` |
| Sentry | ✅ both apps | `main.ts` · mobile `Config.SENTRY_DSN` |
| Firebase FCM | ✅ wired | `modules/notifications` |
| Twilio Verify | ✅ wired (creds set, pending live verify) | `modules/verification` |
| Stripe | ✅ wired, **test mode** | `modules/subscriptions` |
| AWS Rekognition | ❌ not in code (face-compare deferred) | — |
| SendGrid | ❌ not wired (env var in example only) | — |
| Apple Sign-In | ❌ removed from scope 2026-06-05 | — |

## Privacy invariants (non-negotiable)

1. Exact GPS never lands in the DB — fuzzed to H3 r10 centroid at write time.
2. Location + tokens must never appear in Sentry payloads (`sendDefaultPii: false`; scrub before send).

## Known debt (see `STATUS.md` / `TECH_DEBT_AUDIT.md`)

- **C2** — ✅ met (2026-06-11). Every backend module ships ≥1 `.spec.ts`, including `id-verification`.
- **C3** — structured request logging (Pino → Loki/Grafana) deferred; Sentry is the v1 surface. `console.*` still permitted client-side until the `logger` shim lands.
- Mobile tokens in unencrypted AsyncStorage (pre-TestFlight).
- `0020_id_verification.sql` is not idempotent; ID-verification has no automated `pending → verified` path (manual review only).

## Explicitly deferred (do not build without go-ahead)

Stripe Connect / paid gifts · Elasticsearch · Kafka/RabbitMQ · gRPC · Kubernetes/Terraform · GraphQL · InfluxDB · Prometheus/Grafana/Loki · SendGrid email · live streaming · group chat · web/desktop client. (Most are on the `ROADMAP.md` cuts list.)
