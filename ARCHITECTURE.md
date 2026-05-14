# G88 architecture

Living doc. Decisions in here are explicit so they can be argued with. If you change one, update the section and add a dated note at the bottom.

## 1. Goals (in priority order)

1. **Discovery feels instant.** Map opens, nearby points are rendered in <500ms on a warm cache.
2. **Realtime is reliable.** Waves, presence, and chat survive flaky mobile networks and process restarts.
3. **Privacy by default.** A user's precise location is never exposed to other users. Period.
4. **Cheap to run early, scalable when it matters.** One Render service per role at MVP; add replicas before sharding.

Anti-goal: micro-services-from-day-one. Two deployable units (REST API, Realtime gateway) is the maximum until we have load that justifies more.

## 2. Tier map

| Tier | Component | Tech |
|---|---|---|
| Client | Mobile | React Native + TypeScript, RTK, react-native-maps |
| Edge | TLS + LB | Render-provided (or Cloudflare in front) |
| Application | REST API | NestJS, TypeORM |
| Application | Realtime gateway | Socket.IO with Redis adapter |
| Data | Primary store | Postgres 16 + PostGIS + H3-PG |
| Data | Cache / presence / pubsub | Redis 7 |
| Data | Object storage | S3 (or Cloudflare R2) with presigned URLs |
| External | Push | FCM (Android + iOS via APNs proxy) |
| External | Payments | Stripe |
| External | Comms | Twilio (OTP), SendGrid (transactional) |

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

### 3.5 Two services, not one

- **REST API** (`apps/backend`, NestJS over HTTP) — auth, CRUD, discovery query, write paths.
- **Realtime gateway** (same repo, separate `main.ts` and Render service) — Socket.IO with the Redis adapter for cross-instance fan-out. Sticky sessions are required here, not on the REST tier.

Sharing the codebase keeps DTOs and services consistent; deploying separately means we can scale sockets independently of HTTP, and a socket-layer OOM doesn't take down `POST /listings`.

### 3.6 Typed socket contracts

`@g88/shared/events` defines `ClientToServerEvents` and `ServerToClientEvents`. Both the gateway and the mobile `useSocket` hook are generic over these types. Adding a new event without updating the shared types is a compile error.

### 3.7 Viewport-diff protocol (Phase 1.5)

First nearby query returns the full set plus a `viewportHash`. Subsequent queries within the same session send the previous hash; server returns `{added, removed, updated}` diff if the viewport overlaps. Cuts payload and battery further. Behind a feature flag for now — full responses are fine at MVP scale.

## 4. Data model (high level)

See `apps/backend/migrations/0001_initial.sql` for the canonical schema. Key entities:

- `users` — auth identity + profile + `location geometry(Point,4326)` + `location_h3_r{5,7,9,10}` + `verification_level`.
- `events` — host, time window, location, capacity, RSVP count.
- `listings` — seller, price, category, location, status.
- `waves` — from_user_id, to_user_id, context, created_at, responded_at.
- `conversations` + `messages` — chat; a wave becoming reciprocal upgrades to a conversation.
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

- 2026-05-13 — initial draft (H3, server-side clustering, location fuzzing, two-service split).
