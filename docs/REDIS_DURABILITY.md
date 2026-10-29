# NEXA Redis durability contract

Status: release architecture / operations contract for #906.

This document inventories the Redis state used by the NEXA backend and defines what may be lost on a Redis restart, what must fail closed, and what requires restart-survivable abuse-control state or a durable fallback before production sign-off.

It is intentionally **not** a request to persist the current mixed Redis keyspace wholesale. Some keys contain short-lived verification or OAuth flow secrets that are intentionally ephemeral. The production topology must preserve that boundary.

## Current production finding — 2026-10-29

Read-only Render inspection of workspace `g88` shows:

- API: `g88-api` / `srv-d8d8ujojs32c73fb1gfg`
  - plan: `free`
  - instances: `1`
  - region: Frankfurt
  - deploy policy: `checksPass`
- Key Value: `g88-redis` / `red-d8d8u977f7vs73bulhh0`
  - plan: `free`
  - region: Frankfurt
  - `persistenceMode=off`
  - `maxmemoryPolicy=allkeys_lru`
  - Render metadata reports IP allow-list `0.0.0.0/0`; private/internal connectivity and least-privilege network access must be verified before production cutover rather than assuming this is acceptable.

The live API is already using the Redis Socket.IO adapter. This document does not weaken its fail-closed production startup requirement.

## Durability classes

| Class | Meaning | Total Redis loss acceptable? | Required behavior |
| --- | --- | --- | --- |
| E0 — ephemeral | Presence, Pub/Sub, short-lived caches and movement hints | Yes | Rebuild/reconnect automatically; no durable user state is lost |
| E1 — fail-closed transient secret | OTP/PKCE/presign proof with a short TTL | Yes, with UX interruption | Existing flow becomes invalid; user must restart it; never bypass validation |
| C1 — reconstructable coordination | Idempotency, locks, done markers, realtime dedupe | Yes for correctness, duplicate work may occur | Postgres remains authoritative; duplicate durable mutation must still be prevented |
| A1 — abuse-control | Request/send counters that bound brute force or notification spam | **Not safely fail-open** | Counter must survive infrastructure restart or have a durable/shared fallback |

No Redis class is allowed to become the only durable source of truth for accounts, relationships, messages, listings, events, verification status, password reset challenges, or precise location history.

## Key-class inventory

### 1. Presence and nearby movement — E0

Sources:
- `apps/backend/src/modules/presence/presence.service.ts`
- `apps/backend/src/realtime/discovery-presence.publisher.ts`

Key spaces:
- `presence:user:{userId}` — online marker, TTL 120s
- `presence:last_seen:{userId}` — last heartbeat/offline time, TTL 30d
- `presence:user_cell:{userId}` — current presence cell, TTL 120s
- `presence:cell:{h3r8}` — ZSET of current users, TTL 120s
- `discovery:presence-location:{userId}` — short-lived movement handoff, TTL 180s

Authoritative state:
- Current online presence is intentionally Redis-only and ephemeral.
- Canonical fuzzed map location/H3 cells are persisted to Postgres by the heartbeat path before discovery fanout crosses a cell boundary.

Loss behavior:
- Users temporarily appear offline until the next heartbeat/reconnect.
- `last_seen` ranking signal is temporarily absent.
- Movement delta history is discarded.
- No exact GPS becomes newly exposed; loss is privacy-safe.

Decision: **safe to lose; do not add disk persistence solely for presence.**

### 2. Socket.IO and realtime Pub/Sub — E0

Sources:
- `apps/backend/src/realtime/redis-io.adapter.ts`
- `apps/backend/src/realtime/discovery-mutation-bus.service.ts`
- `apps/backend/src/modules/feed/pulse-activity-realtime.service.ts`

Channels / namespaces:
- `nexa:<environment>:<service>:socket.io` Redis-adapter namespace
- discovery mutation Pub/Sub channel
- `pulse:activity:v1`
- `pulse:activity:remove:v1`

Authoritative state:
- Conversation membership, blocks, activity inputs, events/listings/check-ins and other product state remain in Postgres.
- Realtime events accelerate delivery only.

Loss behavior:
- In-flight Pub/Sub messages may be missed.
- Clients must recover through reconnect plus REST/snapshot refresh.
- Precise location delivery remains authorization-gated at emission time; room eviction is defense in depth.

Decision: **safe to lose; must reconnect/recover cleanly.** Pub/Sub payloads must never be made durable merely to compensate for Redis restarts.

### 3. Discovery snapshots and trending cache — E0

Sources:
- `apps/backend/src/modules/discovery/discovery.service.ts`
- `apps/backend/src/modules/trending/trending.service.ts`

Key spaces:
- `discovery:snap:{requesterId}:{viewportHash}` — TTL 30s
- `trending:v1:{h3r7}` — TTL 300s

Authoritative state:
- Postgres/PostGIS and current presence inputs.

Loss behavior:
- Next request performs a full/recomputed response instead of using a previous viewport diff/cache.
- No product state loss.

Decision: **safe to lose and rebuild.**

### 4. Verification OTP — E1

Source:
- `apps/backend/src/modules/verification/verification.service.ts`

Key spaces:
- `verify:email:{userId}` — TTL 10m
- `verify:phone:{e164}` — TTL 10m

Authoritative state:
- Verified email/phone status and verification level are persisted in Postgres only after a successful check.
- Twilio Verify may independently validate configured channels; Redis is also used for the fallback/backup OTP path.

Loss behavior:
- An in-flight Redis OTP becomes invalid/expired.
- The user must request a new code or use the provider-backed verification path when available.
- Missing Redis OTP must never grant verification.

Decision: **safe to lose only because the flow fails closed. Do not persist OTP values to disk just to survive a restart.**

### 5. OAuth PKCE / replay marker — E1

Source:
- `apps/backend/src/modules/social/social.service.ts`

Key space:
- `social:pkce:{nonce}` — one-time flow secret / replay marker, TTL 10m

Authoritative state:
- The verified social-link ownership is stored in Postgres only after callback completion.

Loss behavior:
- An in-flight link callback fails with `social.pkce_missing` and the user restarts linking.
- A missing key cannot be treated as authorized.

Decision: **safe to lose; must remain short-lived and fail closed. Do not add durable persistence solely for this secret.**

### 6. Story upload binding — E1

Source:
- `apps/backend/src/modules/stories/stories.service.ts`

Key space:
- `story:presign:{userId}:{sha256-prefix}` — TTL 300s, consumed once

Authoritative state:
- Story rows are created in Postgres only after the issued media URL is validated.
- Media itself is stored in S3.

Loss behavior:
- A previously issued upload URL can no longer be used to create a story; the client requests a new upload URL.
- Loss cannot turn an untrusted URL into a trusted URL.

Decision: **safe to lose; fail closed and reissue.**

### 7. Password reset — split A1 + durable Postgres

Source:
- `apps/backend/src/modules/auth/password-reset.service.ts`

Redis keys:
- `reset:cooldown:{hmacDigest}` — 60s request cooldown
- `reset:hour:{hmacDigest}` — max 5 requests/hour

Durable Postgres state:
- `password_reset_requests` contains the reset challenge hash, expiry, attempt count and encrypted delivery outbox.
- Password mutation, refresh-token revocation and challenge consumption are transactional in Postgres.

Loss behavior:
- A valid already-issued reset challenge remains intact because it is in Postgres.
- **The Redis request counters reset**, allowing a new request burst earlier than intended.

Decision: **A1 blocker.** Before treating total Redis loss as production-safe, password-reset request limiting must either:
1. gain a durable/shared rate-limit fallback (preferred), or
2. move only non-secret abuse-control counters to a restart-survivable store.

Do not move reset codes or encrypted reset payloads from their current Postgres design into Redis.

### 8. Notification frequency caps — A1

Source:
- `apps/backend/src/modules/notifications/notifications.service.ts`

Key space:
- `notif:cap:{userId}:{channel}:{bucket}` — TTL equals the channel window (1h for most channels, 24h for digest)

Authoritative state:
- Device tokens and notification preferences are in Postgres.

Loss behavior:
- User preferences remain enforced.
- Frequency counters reset, temporarily allowing more pushes than configured.

Decision: **restart-sensitive abuse-control.** Preserve these counters across infrastructure restart or provide a durable/shared cap fallback before production restart testing is signed off.

### 9. Wave idempotency — C1

Source:
- `apps/backend/src/modules/interactions/wave-idempotency.service.ts`

Key spaces:
- `wave:idempotency:{from}:{to}:{context}:lock` — TTL 8s
- `wave:idempotency:{from}:{to}:{context}:result` — TTL 120s

Authoritative state:
- `InteractionsService` + Postgres.

Loss behavior:
- An HTTP/network retry can miss its cached result and reach the durable interaction path again.
- Durable interaction rules remain authoritative; Redis is explicitly only the coordination layer.

Decision: **safe for correctness if Postgres invariants remain enforced; expect degraded retry UX / duplicate work.** Test this explicitly during Redis-restart QA.

### 10. Pulse realtime dedupe — C1

Source:
- `apps/backend/src/modules/feed/pulse-activity-realtime.service.ts`

Key spaces include:
- `pulse:activity:published:*` — TTL 120s
- `pulse:activity:removed:event_join:*` — TTL 120s

Authoritative state:
- Postgres activity/check-in/event consent state.

Loss behavior:
- A transition may be published again after dedupe loss.
- Stable activity IDs/client dedupe and authoritative REST state must prevent this from becoming durable duplicate product state.

Decision: **safe to lose for durable correctness; duplicate realtime work is acceptable only within bounded client/server idempotency guarantees.**

### 11. Event/listing discovery lifecycle locks — C1

Sources:
- `apps/backend/src/modules/events/events-discovery-lifecycle.service.ts`
- `apps/backend/src/modules/listings/listings-expiry.service.ts`

Key spaces:
- `discovery:event-expiry:lock:{eventId}` — TTL 120s
- `discovery:event-expiry:done:{eventId}` — TTL 8d
- `discovery:listing-expiry:lock:{id}:{expiresAtVersion}` — TTL 120s
- `discovery:listing-expiry:done:{id}:{expiresAtVersion}` — TTL 8d

Authoritative state:
- Event/listing expiry and visibility rules are queried from Postgres.
- Redis coordinates multi-instance publication only.

Loss behavior:
- A completed boundary transition may be published again.
- A new sweep reconstructs candidates from Postgres; product state is not lost.

Decision: **safe to lose for correctness; duplicate publication must remain harmless.**

## Production topology decision

### Preferred path: keep sensitive/transient Redis ephemeral; make abuse controls durable elsewhere

Do **not** enable persistence on the current mixed Redis database as a shortcut. The same database currently contains OTPs and OAuth flow secrets that are intentionally short-lived.

Preferred sequence:

1. Move `g88-api` to an always-on production compute plan only after #846 observation evidence remains healthy; keep runtime diagnostics enabled through the cutover window.
2. Move Redis off Free so it is not subject to the Free-tier restart/loss model and production Socket.IO availability is predictable.
3. Keep E0/E1 state explicitly ephemeral.
4. Add restart-survivable storage/fallback for A1 abuse controls (`reset:*`, `notif:cap:*`) before claiming total Redis loss is safe.
5. Re-run the restart matrix below.
6. Restrict network access to the intended private/internal path; do not use public Redis exposure as a workaround.

### Alternative: split Redis roles

If managed persistence is required for rate/cap counters, use separate logical infrastructure:

- **ephemeral Redis:** Socket.IO Pub/Sub, presence, discovery cache, OTP/PKCE/presign bindings, transient coordination;
- **durable control store:** only restart-sensitive non-secret abuse counters.

Do not place precise live-location payloads, OTP values, OAuth verifiers, access tokens, message content or verification media into a durable Redis tier.

## Restart / failover acceptance matrix

These are required before #906 can close.

| Scenario | Expected result |
| --- | --- |
| API process restart | clients reconnect; authenticated REST remains correct; no lost durable messages/relationships/listings/events |
| Redis restart/loss | service recovers connection without silently weakening authorization; no precise GPS reaches revoked users |
| Presence after Redis loss | users are offline until heartbeat/reconnect; presence rebuilds; no exact location recovery/logging |
| Discovery/trending after Redis loss | first request recomputes from Postgres/PostGIS; no stale public cluster counts |
| Active Socket.IO conversation | reconnect/rejoin is reauthorized from current DB membership/block state |
| Live location + block/removal | revoked peer receives no `location:share:*` precise payload before or after reconnect |
| Password reset challenge | already-issued Postgres challenge remains usable until expiry; request-rate protection does not silently reset after A1 remediation |
| Verification OTP | missing Redis OTP fails closed; user can request a new code; no automatic verification |
| OAuth linking | missing PKCE/replay marker fails closed; user restarts link flow |
| Story presign | lost binding invalidates create; user must request/re-upload; arbitrary S3 URL remains rejected |
| Wave retry | durable interaction is not duplicated even if Redis result/lock was lost |
| Notification caps | preference remains enforced and cap does not reset after A1 remediation |
| Event/listing lifecycle | duplicate realtime publication is harmless; HTTP/Postgres discoverability remains authoritative |

## Logging/privacy rules for restart tests

Never log:
- raw access/refresh tokens;
- OTP/reset codes;
- OAuth verifier/state secret;
- raw Redis values;
- message content;
- verification media/ID data;
- exact GPS coordinates or live-location payloads;
- Story presigned URLs.

Allowed evidence should be low-cardinality: service/deploy ID, commit SHA, Redis connection state, restart timestamp, aggregate socket count, pass/fail assertions and sanitized error codes.

## Cutover record required before infrastructure mutation

Before changing Render plans/configuration, record in #906:

- current API and Redis resource IDs;
- current plan/region/instance count;
- selected target API plan;
- selected Redis topology and persistence mode;
- network-access model;
- whether A1 remediation is complete;
- deployment sequence;
- health/reconnect/restart checks;
- rollback target and rollback trigger;
- #846 diagnostics observation window.

No plan or persistence change is authorized by this document alone.

## #906 status after this inventory

This document satisfies the design/evidence portion of:

- Redis key-class inventory by durability requirement;
- explicit decision on safe-to-lose vs restart-sensitive state.

Still open:

- A1 abuse-control remediation or a deliberately separated restart-survivable control store;
- move API off Free;
- move Redis off the Free in-memory-only topology;
- least-privilege/private connectivity verification;
- intentional API + Redis restart/failover QA;
- final plan/configuration + rollback record.
