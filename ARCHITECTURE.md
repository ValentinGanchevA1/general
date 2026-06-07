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

### 3.1 H3 hex index for discovery, not geohash

Geohash cells distort with latitude and the rectangular shape produces ugly "edge effects" when clustering. H3 (Uber's hexagonal hierarchical index) gives near-uniform cell area at any resolution and constant adjacency (each cell has exactly 6 neighbors).

Schema impact: every entity with a location stores its H3 cell IDs at multiple resolutions as indexed columns:

```sql
location_h3_r5  text  -- ~252 km² cells (country-level zoom)
location_h3_r7  text  -- ~5 km² cells (city-level zoom)
location_h3_r9  text  -- ~0.1 km² cells (neighborhood)
location_h3_r10 text  -- ~0.015 km² cells (block)
```

These are computed at write time from `geometry(Point, 4326)`. The discovery query picks a resolution from the viewport zoom, intersects the viewport polygon with H3 cells, then either aggregates by cell (low zoom → clusters) or returns individual entities (high zoom → markers).

### 3.2 Server-side clustering, not client-side

`react-native-map-clustering` does the math on-device, which means we must ship every marker in the viewport over the wire. For a busy city neighborhood that's thousands of points per pan. Wasteful.

Server-side: at zoom < ~14 we return one row per H3 cell with a count. The client renders a numbered cluster bubble. At zoom ≥ 14 we return the actual entities. Bandwidth drops by 10–100×.

### 3.3 Location fuzzing at write time

A user's stored `location` is snapped to the centroid of their H3 r10 cell (~120m across) before persistence. The exact GPS reading never lands in the DB. The user's *own* device retains their precise location locally; nobody else gets it.

This trades a small UX cost (their pin on someone else's map jitters slightly between sessions) for a strong privacy property and a meaningful defense against re-identification.

### 3.4 Presence lives in Redis, not Postgres

Online/offline + last-known coarse location for live discovery. Sorted sets keyed by H3 r8 cell, member = userId, score = last-heartbeat epoch. TTL'd. Writes hit Redis only — never Postgres — so a noisy presence update from 50k users doesn't melt the primary DB.

```
ZADD presence:cell:{h3r8} {nowMs} {userId}
EXPIRE presence:cell:{h3r8} 120
```

Reads: discovery joins the cluster aggregate from Postgres with a presence lookup from Redis to flag which entities are online *now*.

### 3.5 Two services, not one (planned) — one process today

**Target topology:**

- **REST API** (`apps/backend`, NestJS over HTTP) — auth, CRUD, discovery query, write paths.
- **Realtime gateway** (same repo, separate `main.realtime.ts` and Render service) — Socket.IO with the Redis adapter for cross-instance fan-out. Sticky sessions are required here, not on the REST tier.

Sharing the codebase keeps DTOs and services consistent; deploying separately means we can scale sockets independently of HTTP, and a socket-layer OOM doesn't take down `POST /listings`.

**Current reality (as of 2026-06-07):** there is **one** entrypoint, `apps/backend/src/main.ts`, and **one** Render service (`g88-api`). `RealtimeModule` is imported into `AppModule`, so the Socket.IO gateway runs **in-process** with REST — Socket.IO attaches to the same HTTP server (`app.listen(3001)`, namespace `/realtime`). There is no `main.realtime.ts` yet. The split above is the plan for when socket load justifies independent scaling; until then, the single-process form is intentional (cheaper, one deploy). When the split lands, extract a `main.realtime.ts` that boots only `RealtimeModule` + its deps, and point a second Render service at it.

### 3.6 Typed socket contracts

`@g88/shared/events` defines `ClientToServerEvents` and `ServerToClientEvents`. Both the gateway and the mobile `useSocket` hook are generic over these types. Adding a new event without updating the shared types is a compile error.

### 3.7 Activity feed aggregator (`GET /feed`)

The Pulse tab surface aggregates heterogeneous event types (chats, waves, listings, alerts, matches) into a single chronological `ActivityItem[]`. Design choices:

**Pull, not push (v1).** The mobile client fetches on focus and on pull-to-refresh. A `since` cursor lets the client ask for only items newer than the last fetch. Socket push of `activity:new` events is planned for v1.5 — the `ActivityItem` shape is already socket-ready.

**Schema-aware heuristics.** The schema has no `recipient_id` on `messages` (recipient is determined via `conversations.participant_ids`) and no `read_at` (unread is a 24h heuristic: `sender_id ≠ me AND created_at > NOW() - interval '24 hours'`). Waves use `responded_at IS NULL` as the unread proxy. These are acknowledged tech-debt shortcuts (C6 in P2 backlog).

**Shared types, not duplicated DTOs.** `packages/shared/src/activity.ts` owns `ActivityItem`, `ActivityType`, and `FeedResponse`. Both the backend serializer and the mobile `pulseSlice` import from there — adding a new activity type requires one change, not two.

**Deep-link routing.** Each `ActivityItem` carries a `deepLink: { screen, params }` that matches `RootStackParamList`. The mobile layer calls `navigation.navigate(screen, params)` without needing to know what produced the item.

**ActionHub FAB.** The `+` button opens a bottom sheet of quick-action entries, each navigating to the Pulse tab with a `filter` param pre-set. Filter is a URL-like prop (`PulseFilter` in `TabParamList.Pulse`) rather than local state so deep-links and notification taps can land on a specific view.

### 3.8 Migration system

`apps/backend/scripts/migrate.js` runs `.sql` files in `migrations/` in filename order. Applied migrations are recorded in a `schema_migrations` table (created on first run). Re-running `migration:run` skips already-applied files — the command is safe to call on any environment at any time.

Migration files are append-only and never edited after merge. Schema invariants enforced in migrations:

- **`0002_profile_fields.sql`** — adds `bio TEXT` to `users`. Profile completion = `bio IS NOT NULL AND avatar_url IS NOT NULL`.
- **`0003_refresh_tokens.sql`** — opaque refresh token table (DB-stored, hashed, rotating).
- **`0004_oauth.sql`** — OAuth provider linkage for Google (and Apple when it ships).
- **`0005_h3_not_null_backfill.sql`** — enforces H3 cell completeness: CHECK constraint on `users` (location nullable, but if set all r4–r10 cells must be populated); NOT NULL on `events`/`listings`; adds missing r4/r6/r8 indexes for cluster queries at low/mid zoom.

### 3.9 Viewport-diff protocol (Phase 1.5)

First nearby query returns the full set plus a `viewportHash`. Subsequent queries within the same session send the previous hash; server returns `{added, removed, updated}` diff if the viewport overlaps. Cuts payload and battery further. Behind a feature flag for now — full responses are fine at MVP scale.

## 4. Data model (high level)

See `apps/backend/migrations/0001_initial.sql` for the canonical schema. Key entities:

- `users` — auth identity + profile + `location geometry(Point,4326)` + `location_h3_r{5,7,9,10}` + `verification_level`.
- `events` — host, time window, location, capacity, RSVP count.
- `listings` — seller, price, category, location, status.
- `waves` — from_user_id, to_user_id, context, created_at, responded_at (not acknowledged_at), conversation_id when reciprocal.
- `conversations` + `messages` — chat; a wave becoming reciprocal upgrades to a conversation. `messages` has no `recipient_id` (use `participant_ids`) and no `read_at` (unread is a 24h heuristic).
- `device_tokens` — FCM/APNs registration per user per device.

A materialized view `v_discoverable_entity` unions `users`, `events`, `listings` into a single (id, kind, location, h3 cells, visibility) shape so discovery queries don't need three UNIONs at request time.

## 5. Auth and sessions

JWT access token (15min) + opaque refresh token (30d, rotating, stored hashed in Postgres). Refresh on 401. Axios interceptor handles the dance on the mobile side. Socket connections authenticate with the access token at handshake and re-handshake on rotation.

## 6. Observability

- Sentry on both apps (mobile JS errors, backend exceptions).
- Pino structured logs from NestJS → Render log aggregation; ship to Loki/Grafana once we outgrow it.
- Request metrics via `@nestjs/terminus` + Prometheus exporter.
- One synthetic check: signup → discovery → wave → message. Runs every 5 min from CI cron against staging.

## 7. Things explicitly deferred

- Video/voice chat (Socket.IO can't carry this; WebRTC + TURN comes later).
- ML-ranked discovery feed (rule-based for now: distance × recency × verified).
- Multi-region deploy (one region, one Postgres primary, until DAU > ~50k).
- gRPC anywhere (NestJS HTTP is fine; revisit if internal service-to-service explodes).

## Change log

- **2026-06-07** — Doc correction (no code): §3.5 reworded to reflect that the realtime gateway currently runs **in-process** with REST in a single `main.ts` / single Render service (`g88-api`), not as a separate `main.realtime.ts` deploy. The two-service split is retained as the planned topology. `CLAUDE.md` updated in lockstep (stack table, local realtime URL `:3001`, the "Single `main.ts`" convention). `DEPLOY.md` still references a `g88-realtime` service — stale; left for a separate pass.
- 2026-05-13 — initial draft (H3, server-side clustering, location fuzzing, two-service split).
- **2026-05-14** — Reconciliation Phase R1. Pre-monorepo `mobile/` and `backend/` moved under `legacy/` (frozen, read-only — see `legacy/README.md`). `pnpm-workspace.yaml` excludes `legacy/**`. ESLint and CI both block imports from `legacy/`. Tagged `legacy-freeze-2026-05-14`. P1 pillar progress tracked in `STATUS.md`. Old `CLAUDE.md` replaced — see updated version.
- **2026-05-20** — R2 (P0 backend) + R3 (P0 mobile) complete. Chat persistence wired (`chat.service.ts` + `messages` table). REST endpoints for conversations/messages added. Wave sender fully hydrated in `emitWaveReceived`. FCM notifications module added (token registration + send-on-offline). `presence:delta` emitter implemented on H3 cell boundary cross. `conversation:join` socket handler added. Mobile: `AuthScreen`, `ProfileCreationScreen`, `ProfileEditScreen`, `InboxScreen`, `ChatScreen`, `SettingsScreen`, `ErrorBoundary` all ported/rebuilt. `AppNavigator` auth gate implemented.
- **2026-05-21** — R4 (P1 hardening) complete. Auth §5 implemented: refresh tokens are now opaque, DB-stored, rotating, and revocable (`0003_refresh_tokens.sql`). Google OAuth added server + mobile (`0004_oauth.sql`, `POST /auth/oauth/google`). Apple OAuth deferred to P2 (A3) — required before App Store submission. Android CI workflow added with Maps key injection. All 10 Dependabot security advisories patched via pnpm overrides.
- **2026-05-22** — Tooling hardening. Migrated to pnpm 11: workspace settings (`overrides`, `allowBuilds`) moved from `package.json` to `pnpm-workspace.yaml`. CI upgraded to Node 22 (minimum required by pnpm 11). All GitHub Actions workflows opted into Node.js 24 runners ahead of the June 2 forced cutover. Fixed `gradlew` execute-bit (Android Build green). Final Dependabot alert closed (uuid → 11.1.1).
- **2026-05-23** — R5: Pulse v1. Added `GET /api/v1/feed` aggregator (`FeedService`, `FeedModule`). `ActivityItem` / `FeedResponse` shared types in `@g88/shared/activity`. Mobile: `PulseScreen` with filter chips, `pulseSlice` async thunk, `ActionHub` FAB bottom-sheet with `PulseFilter` deep-link routing. Tab bar renamed Map · Pulse · Profile. See §3.7 for design rationale. Added §3.8: migration system — `schema_migrations` tracking table, idempotent `migration:run`, documented per-migration invariants (`0002`–`0005`).


- **2026-05-24** — R6 / P2.5 UX track: `ContextualFab` replaces static `ActionHub`. Context-aware
  speed dial driven by `useFabContext({ zoom, points, nearestUserId })` →
  `pickPrimary(zoomBand, density, visibility, goalsPrimary)`. Decision rule:
  `visibility=off → toggle_visibility` · `near+density≥1 → wave_nearest` ·
  `non-far+trading → create_listing` · else `post_alert` (currently staged to
  `open_pulse` via `POST_ALERT_READY=false` until X3 ships the real composer).
  Pulse screen redesigned card-style (Nextdoor-inspired) with `ShareCTA`,
  `NearbyPeopleStrip` (reads `discovery.points`), `ActivityCard`, and
  `TrendingStrip` (mock until X4 backend contract). Analytics scaffold via
  `lib/analytics.ts` — single entry point, swap impl on OB1. `AlertComposerScreen`
  registered as a modal route placeholder (X3 = real impl).
  Schema: `UserProfile` in `@g88/shared` extended with `goals?: string[]` (optional;
  backend field deferred — not yet persisted, defaults to `'dating'` in `useFabContext`).
  State wiring: `useFabContext` reads from `s.profile.profile` (profile slice), not
  the auth slice — `visibility` maps to `isVisible`, `goals[0]` drives `goalsPrimary`.

- **2026-05-30** — P2 hardening + first production deployment.
  **Deployment**: `g88-api` live at `https://g88-api.onrender.com` (Render Frankfurt, free tier);
  `g88-redis` (Redis 8, Frankfurt) for presence + trending + discovery snapshots.
  Sentry project created (DE region); DSN wired in both apps (OB1 complete).
  Fixed a latent bug: `@UseGuards` on a NestJS WebSocket gateway class does not run
  on `handleConnection` lifecycle hooks — only on `@SubscribeMessage` handlers.
  JWT is now verified directly in `handleConnection` so `client.data.userId` is set
  before the guard re-checks it per message.
  **C6 — Chat outbox**: `chatSlice` gains `outbox: OutboxEntry[]` and `failedIds: string[]`.
  When `chat:send` returns null (socket disconnected), the message is queued instead of
  dropped. On every socket `connect` event, `useSocket` drains the outbox via dynamic
  import (breaks the circular dep `useSocket ↔ chatSlice`), retrying up to 3 times.
  Exhausted entries move to `failedIds`; `ChatScreen` renders ⏱ (pending) or
  "Tap to retry" (failed). `clientMessageId` is threaded through as the optimistic ID
  so the server can deduplicate retries.
  **M1 — Viewport-diff**: `DiscoveryService` stores each response snapshot in Redis
  (`discovery:snap:{viewportHash}`, TTL 30 s). When `POST /discovery/nearby` includes
  `prevViewportHash`, the server fetches the previous snapshot and returns
  `diff: { added, removed }` (by entity `id` / cluster `cellId`) instead of the full
  point set — provided `removed < 60%` of the previous snapshot (otherwise the viewport
  jumped far enough that a full response is smaller). `DiscoveryQuery` and
  `DiscoveryResponse` in `@g88/shared` updated. `useDiscovery` tracks `prevHashRef` +
  `cachedPointsRef`; applies diffs invisibly and exposes a merged `DiscoveryResponse`
  to callers — MapScreen is diff-unaware.
  **A3 — Apple Sign-In (partial)**: `POST /auth/oauth/apple` implemented using
  `apple-signin-auth` for JWK-based identity-token verification; `apple_sub` column
  added (`0009_apple_oauth.sql`); `loginWithApple` thunk added to `authSlice`
  (platform-guarded, iOS only); Apple button rendered in `AuthScreen`.
  iOS entitlements scaffold committed (`ios/G88/G88.entitlements`,
  `ios/Podfile`, `ios/.xcode.env`). Xcode capability + Apple Developer Portal
  (Services ID, key) setup deferred — requires macOS.
  **Synthetic monitor**: `scripts/synthetic-monitor.mjs` tests the full P1 critical
  path (login → discovery → wave → socket chat) every 5 minutes via GitHub Actions
  cron against `g88-api.onrender.com`. P1 DoD gate (7 consecutive days) clock started
  2026-05-30; clears 2026-06-06.

- **2026-05-31** — P3 feature build-out. Common thread: all new awards/pushes are fired
  **fire-and-forget** off the core write path — a failed push or XP award never blocks
  (or rolls back) the wave/alert/chat that triggered it.
  **Push notifications**: chat push wired end-to-end; mobile migrated to
  `@react-native-firebase` v22 **modular API** (the namespaced API is removed in v22).
  CI injects `google-services.json` from a secret.
  **Geofence-triggered alert pushes (P3 #3)**: `NotificationsService.notifyGeofenceMatch`
  uses a **two-stage spatial match** — a cheap `gridDisk(alertCell, 3)` `ANY`-query
  pre-filters candidate geofences in SQL, then each candidate is confirmed in app code
  with the exact test `alertCell ∈ gridDisk(center, radius_rings)`. Two stages because the
  pre-filter's fixed ring-3 bound is index-friendly but coarse; the exact per-geofence
  radius varies, so membership is re-checked precisely. Author is skipped.
  Fired off `AlertsService.create` (which now `RETURN`s `location_h3_r7`). Mobile deep-links
  `data.type='alert'` → Pulse tab, `alerts` filter.
  **Gamification (P3 #1, `0010_gamification.sql`)**: `xp_events` is an **append-only ledger**,
  not a counter — idempotency comes from a partial unique index on `(user_id, dedupe_key)`,
  so a retried award is a no-op insert rather than a double-count. Daily caps are enforced by
  counting same-day rows for a `reason` (indexed) before inserting. `user_gamification` holds
  the denormalized `total_xp / level / streak` so reads don't re-aggregate the ledger.
  Level curve: cumulative XP to reach level L is `50*(L-1)²`; `levelForXp`/`xpForLevel`/
  `summaryForXp` live in `@g88/shared/gamification` so server and client agree. Economy:
  `wave.reciprocated` 50 XP (both sides, once per match), `alert.posted` 20 XP (cap 3/day),
  `trade.completed` 100 XP (reason reserved, no call site until trading ships).
  **Daily challenges (slice 2, `0011_challenges.sql`)**: a fixed 6-challenge catalog; 3 are
  surfaced per day chosen by a **date-seeded shuffle** so every user sees the same set without
  storing a daily assignment. Progress is tracked per `(user_id, challenge_id, day)` PK;
  completion stamps `completed_at` once and awards bonus XP via a new
  `GamificationService.awardRaw(amount, reason, dedupeKey)` variable-amount path
  (`award()` now delegates to it). `xp_events.reason` CHECK widened to admit
  `challenge.completed`. `increment(metric)` is called fire-and-forget from the wave,
  match, alert, and chat write paths. `GET /challenges/today` merges catalog defs with
  per-user progress.

- **2026-05-31 (P4)** — Profile & monetization surface (G1–G5). Theme: every new
  integration is **env-gated** — the code ships inert and a provider/service only
  goes live once its credentials are set (same degrade-gracefully pattern as FCM
  and Sentry), so half-configured infra never reaches prod.
  **G1 — profile data model**: migration `0012_profile_expansion` adds `phone`,
  `date_of_birth`, `subscription_tier` (default `free`), `interests[]` to `users`,
  plus `user_photos` (ordered gallery) and `social_links` (one row per provider).
  `UserProfile` in `@g88/shared` is extended; `age`, `verificationScore` and the
  `badges` object are **derived server-side, never stored** — age via SQL
  `age(date_of_birth)`, score/badges from the cumulative verification ladder
  (`none<email<phone<selfie<id`) + premium tier + a verified social link. The
  ProfileScreen is a pure renderer of that payload.
  **G2 — verification**: `VerificationModule` wraps **Twilio Verify**. `phone/start`
  sends an SMS OTP; `phone/check` confirms it, stores the number, and promotes the
  ladder to at least `phone` (CASE never downgrades selfie/id). Migration `0013`
  adds a partial unique index on `users.phone` (verified numbers) → 409 on
  collision. No creds in non-prod → fixed dev code; missing creds in prod hard-fail.
  **G3 — subscriptions**: Stripe Checkout (hosted) + billing portal, opened from
  mobile via `Linking`. Tier is authoritative **only** through the
  signature-verified webhook (`customer.subscription.*` / `checkout.session.completed`),
  keyed by `stripe_customer_id` — there is no client-trusted path to grant a tier.
  Requires `NestFactory(rawBody:true)` so the webhook can verify the unparsed body
  while JSON parsing still works everywhere else. Price↔tier mapping is env-driven
  (`STRIPE_PRICE_*`), reverse-looked-up on the webhook. Migration `0014`.
  **G4 — social linking**: provider-generic OAuth2 authorization-code linking
  (instagram/twitter/tiktok/facebook/linkedin/spotify) via a server-side callback.
  Authorization-request integrity uses an **HMAC-signed, 10-min stateless `state`**
  (carries userId+provider, signed with `JWT_SECRET`) rather than server session
  storage; the callback exchanges the code, reads the handle, and upserts a
  `verified` `social_links` row, then 302s back to the app. Confidential-client
  flow; providers mandating PKCE (X/Twitter) need a Redis-backed verifier before
  going live. The mobile screen opens the authorize URL in the browser and
  refetches the profile on focus to observe the browser-completed link.
  **G5 — achievements + leaderboard**: backend (catalog in `@g88/shared`, unlock
  `evaluate` wired fire-and-forget into wave-match + alert-post, `GET /achievements`,
  weekly/all-time `GET /gamification/leaderboard`) landed separately; P4 adds the
  mobile screens. Migration `0015_achievements`. Both typechecks clean; backend 7/7.
  **Migration numbering**: the achievements migration was originally a second
  `0012`, colliding with `0012_profile_expansion` (G1). Resolved by moving it to
  `0015_achievements` — it has no dependencies and is the latest feature, while
  `profile_expansion` must stay `0012` ahead of `0013`/`0014`. The `schema_migrations`
  row was renamed in lockstep; all DDL is idempotent so re-applies are no-ops.

- **2026-06-01** — Interest-based messaging gate. The dot-tap card is now
  state-aware: **Wave** (stranger) · **Message** (match → full chat) ·
  **Message + "you both like…"** (shared interest/goal → request). The wave→match
  ladder is kept; on top of it a **shared-interest message-request** path allows
  exactly one message until the recipient replies, then promotes to full chat.
  A new `MessagingService` owns the single source of truth for the gate —
  `messagePermission = match ∨ (interest ∪ goal overlap)` — and is consumed by both
  `UsersService` (a viewer-relative `relationship` block on `GET /users/:id`) and
  `POST /conversations` (mints a `pending` request or returns the existing match
  convo; `chat.locked` otherwise). `chat.persist` enforces the one-message cap +
  recipient-reply promotion inside a `FOR UPDATE` tx, so two racing sends can't both
  pass the cap; a reciprocal wave promotes any prior pending request. Migration
  `0017_message_requests` adds `conversations.status` (`pending`/`accepted`, default
  `accepted`) + `initiated_by`. Shared: `MessagePermission`, `ProfileRelationship`,
  `ConversationStatus`, `CreateConversation{Request,Response}`; `ConversationSummary`
  gains `status`/`initiatedBy`. Mobile: `EntityBottomSheet` Message button + shared-
  interest hint; `ChatScreen` request banner + composer lock. **Trade** and
  **friend/follow** dot-actions remain deferred. Next migration `0018`.

- **2026-06-02** — Docs correction (no code): production Postgres runs on **Supabase**
  (`aws-0-eu-west-1.pooler.supabase.com`), not Render-managed Postgres as previously
  documented. Both `.env` files and the migration runner target it; it holds the live
  schema through `0017`. Render still hosts the **web services** (`g88-api`,
  `g88-realtime`) + Redis. `CLAUDE.md`, `DEPLOY.md`, `STATUS.md` updated.

- **2026-06-04** — P5: Gifts (XP-funded, v1) + Challenges mobile screen. Branch
  `feat/gifts-and-challenges`, migration `0018_gifts`. **Design hinge — dual-balance
  wallet**: XP was an append-only *score* (`total_xp`, drives level + leaderboard), so
  gifts can't spend it directly without corrupting rank. Resolved by **decoupling spend
  from score** — a new `spendable_xp` balance is funded 1:1 in `awardRaw` as XP is
  earned (existing users' lifetime XP backfilled as an opening balance), while
  `total_xp` is never debited. `gift_catalog` (6 seeded gifts) + `gifts` table;
  `POST /gifts/send` debits the wallet inside a `FOR UPDATE` transaction (no double-
  spend on concurrent sends), alongside catalog/balance/received reads. The recipient
  earns a fixed **`gift.received`** reward (10 XP, **daily-capped at 5** via the
  existing ledger cap) — this bounds XP minting from gift-trading rings. **No
  refund/undo in v1 — a sent gift is final** (deliberate scope cut; revisit if
  mistake-sends become a support burden). Realtime: `gift:received` server→client
  event; the gateway emits live and falls back to FCM push **only** when the recipient
  has no socket (mirrors the offline-chat push pattern). Mobile: `features/gifts/`
  hooks + `SendGiftSheet` (affordability-gated catalog grid + optional note),
  `GiftsInboxScreen` (balance + received list), entry points on UserProfile + a
  chat-composer 🎁 affordance; push tap deep-links to GiftsInbox. **Challenges mobile
  screen** replaces the "Coming soon" placeholder with a real `ChallengesScreen` over
  the existing `GET /challenges/today` (no new migration; uses `0011`). Both typechecks
  clean; `0018` applied to prod and curl-verified (atomic debit, insufficient-funds
  rollback, self-gift reject, sender-score integrity, deduped recipient reward). The
  realtime + offline-push path is **code-verified, not run-verified** (needs two socket
  clients + `FIREBASE_CREDENTIALS`). Next migration `0019`.

- **2026-06-05** — Apple Sign-In (A3) removed from scope. Reverses the A3 work from
  the 2026-05-30/05-31 entries above. Backend drops `POST /auth/oauth/apple`,
  `AuthService.appleOAuth`, `AppleOAuthDto`, and the `apple-signin-auth` dep; mobile
  drops the `loginWithApple` thunk + reducer cases, the "Continue with Apple" button,
  and `@invertase/react-native-apple-authentication`; the iOS `G88.entitlements`
  Apple-Sign-In capability is deleted (generic Podfile/.xcode.env kept). Migration
  `0019_drop_apple_oauth` drops the `apple_sub` column + unique index (reverts `0009`,
  `IF EXISTS`-guarded; the column was empty everywhere — Apple OAuth never had working
  creds). **App Store consequence**: Apple's guideline 4.8 requires Sign in with Apple
  whenever an app offers a third-party social login. Google OAuth is live, so a future
  iOS submission must re-add Apple, drop Google on iOS, or offer email-only on iOS.
  Inert today — the product is Android-first (no real Xcode project, Android-only CI).
  Next migration `0020`.
