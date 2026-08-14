# G88 architecture

Living doc. Decisions in here are explicit so they can be argued with. If you change one, update the section and add a dated note at the bottom.

## 1. Goals (in priority order)

1. **Discovery feels instant.** Map opens, nearby points are rendered in <500ms on a warm cache.
2. **Realtime is reliable.** Waves, presence, and chat survive flaky mobile networks and process restarts.
3. **Privacy by default.** A user's precise location is never exposed to other users. Period.
4. **Trust is progressive.** Soft gates early; hard gates (phone, ID) only for higher-stakes actions.
5. **Ship Android first.** iOS follows once the core loop is proven.

## 2. Tier map

| Tier        | Component                      | Notes |
|-------------|-------------------------------|-------|
| Client      | Mobile (`apps/mobile`)         | React Native 0.83 + RTK + Navigation 7 |
| Client      | Admin dashboard (`apps/admin`) | Vite + React + shadcn/ui — ID-verification queue, live socket feed; origin `http://127.0.0.1:5173` |
| Edge        | API + realtime (`apps/backend`)| NestJS single process today; planned REST/realtime split |
| Shared      | `@g88/shared`                  | DTOs, socket events, geo helpers — mobile + backend + admin |
| Data        | Postgres + PostGIS + H3-PG     | Supabase managed; migrations `0001`–`0031` |
| Cache       | Redis 7                        | Presence ZSETs, rate limits, OTP, viewport snapshots |
| Object store| AWS S3                         | Avatars, gallery, ID docs, stories, listing photos |
| Push        | FCM                            | Offline waves/chat/gifts; geofence alerts |
| Ops         | Sentry + GitHub Actions        | Shared PII scrubber; synthetic monitor |

## 3. Key design decisions

### 3.1 H3 hex index for discovery, not geohash

H3 gives equal-area cells and a clean parent/child hierarchy for multi-resolution clustering. Discovery queries use cell rings / covering at zoom-appropriate resolution; PostGIS geography backs distance when needed.

### 3.2 Server-side clustering, not client-side

At city density, shipping every point to the client is wasteful. Backend clusters below a zoom threshold and returns cluster markers + individual points only when zoomed in.

### 3.3 Location fuzzing at write time

Exact GPS never lands in the DB. Writes fuzz to **H3 r10 centroid** (~120m). Map markers and public profiles only ever see fuzzed coordinates. This is a hard invariant, not a soft preference.

### 3.4 Presence lives in Redis, not Postgres

Presence is ephemeral (120s TTL ZSETs per H3 r8 cell). Crossing a cell boundary emits `presence:delta` to the room. Postgres holds durable profile + discovery positions only.

### 3.5 Two services, not one (planned) — one process today

- **REST API** (`apps/backend`, NestJS over HTTP) — auth, CRUD, discovery query, write paths.
- **Realtime gateway** (Socket.IO + Redis adapter) — presence, waves, chat, story:new, admin queue events.

**Current reality (as of 2026-06-07):** there is **one** entrypoint, `apps/backend/src/main.ts`, and **one** Render service (`g88-api`). `RealtimeModule` is imported into `AppModule`, so the Socket.IO gateway runs **in-process** with REST — Socket.IO attaches to the same HTTP server (`app.listen(3001)`, namespace `/realtime`). There is no `main.realtime.ts` yet. The split above is the plan for when socket load justifies independent scaling; until then, the single-process form is intentional (cheaper, one deploy). When the split lands, extract a `main.realtime.ts` that boots only `RealtimeModule` + its deps, and point a second Render service at it.

### 3.6 Typed socket contracts

`ClientToServerEvents` + `ServerToClientEvents` live in `@g88/shared/events`. Untyped emits are a compile error.

### 3.7 Activity feed aggregator (`GET /feed`)

Pulse is a read model over chats + waves (+ alerts). Not a separate event store.

### 3.8 Migration system

`apps/backend/scripts/migrate.js` runs `.sql` files in `migrations/` in filename order. Applied migrations are recorded in a `schema_migrations` table (created on first run). Re-running `migration:run` skips already-applied files — the command is safe to call on any environment at any time.

**Prefix uniqueness:** each `NNNN_` must be unique on disk. `migrate.js` can rename tracker rows when a file was renumbered after apply (see `RENAMES`). CI runs `check-migration-prefixes.mjs` (filesystem-only) so dual-prefix collisions fail PRs before they reach prod.

### 3.9 Viewport-diff protocol (Phase 1.5)

Server stores a short-TTL Redis snapshot of the last nearby response. Subsequent pans with a valid `prevViewportHash` get `{ added, removed }` instead of a full set.

### 3.10 Ephemeral stories — exact-write, fuzzed-read (P4.S)

Stories store author-relative media with expiry. Nearby story queries respect the same location-privacy surface as discovery (fuzzed positions on read). Soft post-gate: email verified + account age (phone reserved for higher-stakes actions).

### 3.11 Chat live-location share — a scoped exception to location fuzzing

Timed 1:1 live location sessions are an explicit, consented exception: coordinates stream only to the conversation peer for a bounded TTL, then end. Documented in `docs/SPEC_CHAT_LIVE_LOCATION.md`. Not a general precise-GPS API.

### 3.12 ID-verification: Rekognition is assist-only

`RekognitionService.analyzeVerification` runs AWS Rekognition face-compare between the submitted ID document and the account's existing selfie/photo, but the resulting similarity score is surfaced to a human admin as a decision aid — nothing in the pipeline auto-approves or auto-rejects on that score. `decideVerification()` stays a manual `AdminGuard`-protected action; Rekognition only makes that action faster to reason about. The decide path is transaction-wrapped with an atomic conditional `UPDATE ... WHERE status = 'pending'` so two admins can't double-process the same submission.

### 3.13 OAuth PKCE (S256) for social login

Social OAuth linking stores `code_verifier` in Redis (GET+DEL) and uses S256 challenge to reduce interception risk on the redirect path.

### 3.14 Admin dashboard — separate client, shared backend contract

`apps/admin` (Vite + React + shadcn/ui) is a fourth workspace app. It talks to the same `g88-api` REST + Socket.IO surface as mobile (no separate backend), authenticates via `AdminGuard`-protected routes (`ADMIN_USER_IDS` allow-list), and gets live queue updates over the existing realtime gateway rather than polling. Dev server binds **`127.0.0.1:5173`** (`strictPort`) — that origin must appear in `CORS_ORIGINS` (`localhost` ≠ `127.0.0.1`). Tokens live in browser localStorage (`adminToken` / `adminRefreshToken` / `adminUser`). Today it's a single feature (ID-verification review queue); expand only behind the same AdminGuard.

## 4. Data model (high level)

- **users** — profile, verification ladder, hometown/age visibility flags, spendable_xp / total_xp
- **presence / discovery** — H3 cells + `v_discoverable_entity` view (excludes blocks both directions)
- **waves / conversations / messages** — match ladder + optional pending message requests
- **user_blocks** — directional storage, symmetric effect
- **stories / story_reactions** — ephemeral, author-scoped
- **user_id_verifications** — pending → verified/rejected via admin decide
- **listings / offers** — local trade, no payment in v1
- **events / attendees / polls / questions** — RSVP + live poll/Q&A deltas

Exact column lists: `apps/backend/migrations/`.

## 5. Auth and sessions

- Access JWT ~15m; refresh opaque, DB-stored, rotating, family-revocable (~30d).
- Mobile tokens in OS secure store (Keystore/Keychain), not plaintext AsyncStorage.
- Admin uses the same login endpoint; authorization is `AdminGuard` + `ADMIN_USER_IDS`.

## 6. Observability

- Sentry on both apps (mobile JS errors, backend exceptions). PII/secret scrubbing is a shared implementation (`packages/shared/src/scrub.ts`, PR #80, 2026-08-11) — both apps' `beforeSend` hooks call the same scrubber, with a dedicated spec (`sentry-scrub.spec.ts`) so the rule set can't silently drift between mobile and backend.
- Synthetic monitor: login → discovery → wave → chat against prod.
- Structured request logging (Pino → Loki) still deferred (debt C3).

## 7. Things explicitly deferred

Stripe Connect / paid gifts · Elasticsearch · Kafka · gRPC · K8s/Terraform · GraphQL · group chat · live streaming · full web consumer client. Admin stays operator-scoped, not a second consumer product.

## Change log

- **2026-08-14** — Doc sync: `CLAUDE.md` gains full `apps/admin` coverage (repo layout, conventions, codebase-reference section, admin API rows, Rekognition assist status). Tier map + §3.14 wording tightened (CORS origin, token keys, AdminGuard). ARCHITECTURE restored to monorepo root if absent.
- **2026-08-13** — Backfilled six weeks of undocumented architectural changes (168 commits, 2026-06-26 → 2026-08-12): added §3.10–§3.14 (Stories, chat live-location exception to fuzzing, Rekognition assist-only, OAuth PKCE, admin dashboard topology); added `apps/admin` to the tier map; documented the Sentry PII scrubber. Full narrative detail lives in `STATUS.md`'s "Build-out since 2026-06-26" section — this doc only captures the *how/why*, per the doc-hierarchy split.
- **2026-06-14** — Auth tokens encrypted at rest on mobile (Keystore/Keychain).
- **2026-06-11** — Viewport-diff, chat outbox, and P2 gate list closed; Android-first beta path documented.
- **2026-05-30** — Deployed Render `g88-api` + Redis; Sentry; single-process realtime confirmed.
