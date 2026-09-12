<!-- C:\Users\vganc\g88\ROADMAP.md -->

# G88 — Roadmap

> **Authoritative source for sequence and timing.**
> Sibling docs: `PRODUCT.md` (what/why), `SPECIFICATION.md` (per-feature contracts), `ARCHITECTURE.md` (how), `STATUS.md` (live progress).
> Last revised: 2026-09-12 (P2.B1 remaining-scope cleared after wave-block verification; original body dated 2026-05-23).

---

## Status snapshot

| Phase                       | Status             | Gate                                                    |
|-----------------------------|--------------------|---------------------------------------------------------|
| P1 — foundation             | ✅ shipped          | Auth · Profile · Map Discovery · Presence · Wave · Chat |
| P2 — pre-launch hardening   | ✅ shipped          | Android beta gate — see STATUS.md for remaining owner-side Play Console steps |
| P3 — habit-forming features | ✅ shipped          | All P3.1–P3.7 surfaced in mobile as of 2026-06-15       |
| P4+ — horizon               | 🟡 active (partial) | P4.S (Stories) shipped ahead of gate; rest still gated on P3 retention |

Target launch market: **Varna, BG** (single test city — see `PRODUCT.md` § Launch market).

## How to read this doc

- **P2 is detailed** because work is active. Each item has scope, acceptance criteria, and risk notes.
- **P3 is epic-level** because work hasn't started. Each epic gets a full `SPECIFICATION.md` entry before code is written.
- **P4+ is intentionally vague** — these are anchors for "not now" decisions, not commitments.

## Phase legend

```
🟢 done    🟡 in flight    ⏳ next    📋 horizon    ❌ explicitly cut
```

---

## P2 — Pre-launch hardening (active)

Six items, ordered. Each must close cleanly before the next starts. B1 (Blocks) was added after this doc's original scoping — its backend landed alongside other June 2026 fixes and it belongs in P2 as a safety baseline, not P3.

### P2.A4 — Dev-secret cleanup

|                |                                                                                                                                                                                          |
|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Hardcoded dev secrets and example envs in repo create a leak surface and confuse Render env reality                                                                                      |
| **Scope**      | Audit `apps/backend/src/**` + `apps/mobile/src/**` for `JWT_SECRET`, `STRIPE_*`, `TWILIO_*`, `AWS_*` literals · move all to `.env` · rotate any committed values · update `.env.example` |
| **Acceptance** | `git grep -E '(JWT_SECRET\|sk_test\|AC[0-9a-f]{32})'` returns 0 hits in non-`.env*` files · Render deploys green · CI passes                                                             |
| **Risk**       | Production deploy could fail if a Render env var is missing the new key name → mitigate with deploy preview                                                                              |
| **Effort**     | 0.5 day                                                                                                                                                                                  |
| **Blocks**     | Nothing strictly, but should land before Sentry (OB1) to avoid sending secrets to Sentry breadcrumbs                                                                                     |

### P2.OB1 — Sentry integration (TestFlight blocker)

**✅ Shipped + hardened (2026-08-11, PR #80).** Shared PII/secret scrubber (`packages/shared/src/scrub.ts`) with a dedicated spec; backend + mobile `beforeSend` wired. See STATUS.md build-out section.

|                |                                                                                                                                                                                                             |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Crash visibility is non-negotiable for public TestFlight. C3 (no observability) is a Critical-severity debt item.                                                                                           |
| **Scope**      | `@sentry/react-native` in mobile · `@sentry/nestjs` in backend · DSN per env · source-map upload in mobile release script · PII scrubbing (no email/phone/location in breadcrumbs) · alert routing to Slack |
| **Acceptance** | A deliberate test crash from mobile appears in Sentry within 60s with symbolicated stack · backend unhandled exception appears with request context (no PII) · alert fires                                  |
| **Risk**       | Sentry quota burn from noisy errors → set traceSampleRate to 0.1 in prod, 1.0 in dev · PII leak via breadcrumb auto-capture → manual `beforeSend` scrubber                                                  |
| **Effort**     | 1.5 days                                                                                                                                                                                                    |
| **Blocks**     | TestFlight release                                                                                                                                                                                          |

### P2.A3 — Apple Sign-In (App Store blocker)

|                |                                                                                                                                                                                                                                                                                                                                                                             |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Apple requires Sign in with Apple if the app offers any other social login (Google is live → Apple is mandatory)                                                                                                                                                                                                                                                            |
| **Status**     | ⚠️ **Reset, not in-progress.** `0009_apple_oauth.sql` was dropped by `0019_drop_apple_oauth.sql`. There is no existing Apple OAuth schema or backend route to resume — this is a from-scratch implementation, not a re-enable.                                                                                                                                              |
| **Scope**      | New migration for `appleUserId`/`appleSub` column(s) · `@invertase/react-native-apple-authentication` on iOS · backend route `POST /auth/apple` verifies identity token against Apple public keys · upsert user (handle the email-relay case — Apple may return `private-relay` email) · persist Apple-provided name on first auth (only returned once) · return token pair |
| **Acceptance** | iOS Sign-in-with-Apple button works on real device · returning user maps to same account · `private-relay` emails handled · name captured on first auth · Android build doesn't break                                                                                                                                                                                       |
| **Risk**       | Apple's "hide my email" relay → must not assume email = identity; rely on `sub` claim · iOS-only flow → no Android impact · Apple Developer Program enrollment ($99/yr) is a pending prerequisite, not yet confirmed                                                                                                                                                        |
| **Effort**     | 1.5 days *(re-estimate once rebuild scope is confirmed — original estimate assumed reusable schema)*                                                                                                                                                                                                                                                                        |
| **Blocks**     | App Store submission · public TestFlight                                                                                                                                                                                                                                                                                                                                    |
| **Spec**       | See `SPECIFICATION.md` § Auth / A3                                                                                                                                                                                                                                                                                                                                          |

### P2.C6 — Mobile chat outbox

|                |                                                                                                                                                                                                                                                                                            |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Chat sent over flaky mobile networks currently fails silently. The single biggest UX risk for the chat pillar.                                                                                                                                                                             |
| **Scope**      | Local persistent queue (`@react-native-async-storage/async-storage`) of pending messages · UI states: `pending → sending → sent → failed (retry)` · automatic retry on network restore (NetInfo) · idempotency key on backend so retries don't double-send · WS reconnect drains the queue |
| **Acceptance** | Airplane-mode send → message persists locally with `pending` indicator · network returns → auto-sends within 3s · backend receives same message exactly once (idempotency) · queue survives app kill                                                                                       |
| **Risk**       | Idempotency key collisions if generated client-side → use `uuid v4` + composite uniqueness `(senderId, clientMessageId)`                                                                                                                                                                   |
| **Effort**     | 2 days                                                                                                                                                                                                                                                                                     |
| **Spec**       | See `SPECIFICATION.md` § Chat / C6                                                                                                                                                                                                                                                         |

### P2.M1 — Viewport-diff protocol

|                |                                                                                                                                                                                                                                                                       |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Mobile pulls full nearby-user payload on every viewport change. Wasteful on data + battery.                                                                                                                                                                           |
| **Scope**      | Backend `POST /discovery/nearby` (viewport body) accepts `?since=ts&previousIds=…` · returns `{ added: [], updated: [], removed: [] }` · mobile `discoverySlice` applies diffs · WS `nearby:update` already does this for individual users — extend to viewport-level |
| **Acceptance** | Median bytes/viewport-change drops ≥ 60% in dev measurement · no visible regression in map render · works correctly across viewport pan vs zoom                                                                                                                       |
| **Risk**       | Stale client state if a diff is dropped → fall back to full fetch on any missing-id signal                                                                                                                                                                            |
| **Effort**     | 2 days                                                                                                                                                                                                                                                                |
| **Spec**       | See `SPECIFICATION.md` § Map / M1                                                                                                                                                                                                                                     |
| **Doc note**   | There is no `locations` module. Geo/nearby logic lives in `modules/discovery`; the real endpoint is `POST /discovery/nearby` with a viewport body, not `GET /locations/map-data`.                                                                                     |

### P2.B1 — Block/mute (pre-launch safety requirement)

|                     |                                                                                                                                                                                                                                                                                                                  |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**             | User blocking is a pre-launch safety baseline, not a deferred nicety. Its absence was identified as a genuine safety gap.                                                                                                                                                                                        |
| **Status**          | ✅ Shipped (2026-06-28, closed out 2026-08-xx). `0026_blocks.sql`, full `BlocksModule` registered in `app.module.ts`, mobile block button + `BlockedUsersScreen` wired against live endpoints (PR #79). Discovery/messaging exclusion confirmed bidirectional. |
| **Remaining scope** | **None for B1 core.** Waves blocked via `interactions.service.ts` → `BlocksService.isBlocked` (`403 wave.blocked`). `BlocksModule` registered. Mobile block + `BlockedUsersScreen` live. Optional residual: hide blocked authors' events/listings when `authorId` lands in view meta. |
| **Acceptance**      | Blocking bidirectional across discovery, messaging, waves · `BlocksModule` registered · mobile block action from profile/chat · **met on master (verified 2026-09-12)** |
| **Effort**          | 0 days remaining (core closed; was ~1 day residual)                                                                                                                                                                                                                                                    |

### P2 total

P2.B1 residual closed 2026-09-12 (docs catch-up). Remaining P2 owner-side items are App Store / Play Console gates, not engineering scope in this table. Historical estimate was ~8.5 dev-days; B1 no longer adds residual engineering days.

---

## NOTE

Full historical P3–P4 sections retained in git history prior to 2026-09-12 docs sync. See previous master commits for complete epic text if needed. This restore prioritizes fixing the accidental PLACEHOLDER overwrite of ROADMAP.md.
