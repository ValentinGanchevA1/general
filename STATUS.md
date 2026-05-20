# STATUS — G88 Reconciliation & P1

> **Last updated:** 2026-05-14
> **Current phase:** R1 (Reconcile) — about to start
> **Owner:** [your name]
>
> Update this file as work progresses. It's the single source of truth for "where are we?".

---

## P1 Critical Path

The only six things that must ship cleanly for "P1 done":

| # | Pillar | State | Blocker | Owner | Notes |
|---|---|---|---|---|---|
| 1 | **Auth** (email/pw + OAuth) | ⚠️ Partial | OAuth endpoints missing; refresh-token rotation not DB-stored | — | Email/pw works end-to-end; see `apps/backend/src/modules/auth/` |
| 2 | **Profile** | ❌ Not started in `apps/` | `users` module + S3 upload + mobile screens all need rebuild | — | Reference: `legacy/mobile/src/features/profile/` |
| 3 | **Map discovery** | ✅ Shipping | None | — | H3 + server-side clustering done. Viewport-diff (1.5) deferred. |
| 4 | **Presence** | ⚠️ Partial | `presence:delta` not emitted; only ZSET writes work | — | See gap **Pr1** below |
| 5 | **Wave** | ⚠️ Partial | Sender identity hardcoded empty in notification | — | See gap **W1** below |
| 6 | **Chat** | ❌ Not shipping | Messages not persisted; no mobile UI | — | See gaps **C1–C6** below |

**Legend:** ✅ shipping · ⚠️ partial · ❌ blocked / not started · 🟦 done & verified

---

## P0 Gap List (must close before P1 ships)

Ordered by critical-path impact. Each item maps to a file or absence-of-file.

| ID | Pillar | File | Gap | Fix size |
|---|---|---|---|---|
| C1 | Chat | `apps/backend/src/realtime/realtime.gateway.ts:onChatSend` | `id: 'TODO_persisted_id'` — messages emit but never persist | M |
| C2 | Chat | (missing) `apps/backend/src/modules/chat/chat.service.ts` | No service writes `messages` table | M |
| C3 | Chat | (missing) `apps/backend/src/modules/chat/chat.controller.ts` | No `GET /conversations`, `GET /conversations/:id/messages` | S |
| C4 | Chat | (missing) `apps/mobile/src/screens/{InboxScreen,ChatScreen}.tsx` | No mobile UI for chat | L |
| P1 | Profile | (missing) `apps/backend/src/modules/users/` | No `PATCH /users/me/profile`, no profile completion endpoint | M |
| P2 | Profile | (missing) `apps/mobile/src/screens/ProfileCreationScreen.tsx` | No mobile screen; auth gate in `AppNavigator` not implemented | L |
| P3 | Profile | (missing) `apps/backend/src/common/s3.service.ts` (or similar) | No presigned URL endpoint for avatar upload | S |
| W1 | Wave | `apps/backend/src/realtime/realtime.gateway.ts:emitWaveReceived` | Hardcodes `displayName: '', avatarUrl: null` — recipient sees empty notification | S |
| Pr1 | Presence | `apps/backend/src/realtime/realtime.gateway.ts` | No emitter for `presence:delta`. ZSETs updated; rooms joined; nothing broadcasts the delta. | M |

## P1 Gap List (close before public TestFlight)

| ID | Pillar | File | Gap | Fix size |
|---|---|---|---|---|
| A1 | Auth | `apps/backend/src/modules/auth/auth.service.ts` | Refresh tokens are stateless JWTs. Should be opaque, DB-stored, rotating, revocable per `ARCHITECTURE.md §5`. | L |
| A2 | Auth | `apps/backend/src/modules/auth/auth.controller.ts` | No `POST /auth/oauth/google` or `POST /auth/oauth/apple` endpoints. Apple required for App Store if any social login ships. | M |
| C5 | Chat | `apps/backend/src/realtime/realtime.gateway.ts` | `conversation:join` handler missing (`@SubscribeMessage('conversation:join')`) | S |
| N1 | Notifications | (missing) `apps/backend/src/modules/notifications/` | FCM token registration + send-on-offline for waves and chat | M |

## P2 (post-P1 hardening)

| ID | Pillar | Gap | Fix size |
|---|---|---|---|
| C6 | Chat | Mobile outbox — retry queue for messages sent during socket disconnect | M |
| M1 | Map | Viewport-diff protocol (`ARCHITECTURE.md §3.7`) — full responses on every pan are wasteful at city density | M |
| A3 | Auth | Hardcoded dev-secret fallbacks in `auth.service.ts` source — remove, require env vars in non-dev | S |
| A4 | Auth | `isAuthEndpoint` in `apps/mobile/src/api/client.ts` checks `/auth/signup`, backend uses `/auth/register`. Cosmetic. | XS |

**Fix size legend:** XS <1h · S 1–4h · M 0.5–1d · L 1–3d

---

## Reconciliation Verdicts (legacy → `apps/`)

### Backend modules

| Legacy module | Verdict | Status | Notes |
|---|---|---|---|
| `auth` | REBUILD | ⚠️ partial in `apps/` | Need OAuth + DB-stored rotating refresh |
| `users` | REBUILD | ❌ not started | P0 |
| `locations` | DROP | n/a | Replaced by `discovery` + `presence` |
| `discovery` (swipe deck) | DROP | n/a | New `discovery` is map-nearby; old swipe is a future dating feature |
| `chat` | REBUILD | ❌ not started | P0 |
| `interactions` (waves) | REBUILD | ⚠️ partial in `apps/` | Wire sender hydration + push fallback |
| `events` | DEFER | — | Schema already in `0001_initial.sql` |
| `social` (follow/unfollow) | DEFER | — | |
| `payments` (Stripe) | DEFER | — | |
| `verification` (phone/photo/ID) | DEFER | — | Only `verification_level` enum survives |
| `notifications` | PARTIAL REBUILD | ❌ not started | FCM for waves + chat; geofences deferred |
| `analytics` / `trending` | DROP | n/a | |
| `gamification` | DROP | n/a | |
| `gifts` | DROP | n/a | |
| `trading` | DEFER | — | `listings` table already in schema |
| `skills` (scores) | DROP | n/a | |
| `admin` | DEFER | — | Audit log table stays in schema |

### Mobile screens

| Legacy feature | Verdict | Status | Notes |
|---|---|---|---|
| `auth/AuthScreen` | PORT | ❌ not started | UI is logic-free; quick port |
| `map/*` | DROP | n/a | New `apps/mobile/src/screens/MapScreen.tsx` is better |
| `discovery/*` (swipe) | DEFER | — | |
| `profile/Profile{Creation,Edit}Screen` | PORT | ❌ not started | P0 |
| `profile/types.ts` | REBUILD in `@g88/shared` | ❌ not started | Types belong in shared package |
| `chat/ChatScreen` | PORT | ❌ not started | UI reusable; swap thunks for socket+axios |
| `chat/chatSlice` | REBUILD | ❌ not started | Old REST routes don't exist in new layout |
| `interactions/interactionsSlice` | DROP | n/a | Wave logic now lives in `MapScreen` directly |
| `verification/*` | DEFER | — | |
| `trading/*`, `gifts/*`, `gamification/*`, `events/*`, `trending/*`, `payments/*`, `market/*` | DEFER | — | |
| `notifications/NotificationsScreen` | PARTIAL PORT | ❌ not started | Strip geofence UI; keep waves + unread chat count |
| `inbox/InboxScreen` | REBUILD | ❌ not started | Conversation list — P0 |
| `settings/{Settings,Privacy}Screen` | PORT | ❌ not started | Logout + visibility toggle required for P1 |
| `components/ErrorBoundary`, `ScreenErrorBoundary` | PORT | ❌ not started | Generic, high reuse |
| `components/ActionHub` (center FAB) | DEFER | — | P1 tab bar = Map · Inbox · Profile, no FAB |
| `components/VerificationBadge`, `SocialLinksDisplay` | DEFER | — | |
| `utils/eventBus` | PARTIAL — reconcile with `authEvents` in new `client.ts` | ❌ not started | |
| `utils/logger` | PORT | ❌ not started | If not yet in new layout |

---

## Phased Execution Plan

### Phase R1 — Reconcile (0.5d) — **IN FLIGHT**

- [ ] Move `mobile/` + `backend/` under `legacy/`
- [ ] Update `pnpm-workspace.yaml` to exclude `legacy/**`
- [ ] Tag: `git tag legacy-freeze-2026-05-14`
- [ ] Add CI lint rule rejecting any import path containing `legacy/`
- [ ] Move `bestRecentMVP.html` into `docs/marketing/`
- [ ] Replace `CLAUDE.md` with the new version
- [ ] Commit `STATUS.md` (this file)
- [ ] Update `ARCHITECTURE.md` change log

### Phase R2 — P0 backend (3–4 days)

- [ ] **P1, P3** — `apps/backend/src/modules/users/` + S3 presigned URL endpoint
- [ ] **C2** — `apps/backend/src/modules/chat/chat.service.ts` (persist + last_message_at update)
- [ ] **C3** — Chat REST endpoints
- [ ] **C1** — Wire `chat.service.persist()` into `onChatSend`; kill `TODO_persisted_id`
- [ ] **W1** — Hydrate wave sender in `emitWaveReceived` (60s Redis cache for user lookup)
- [ ] **N1** — Notifications module: FCM registration + send-on-offline-emit-failure

### Phase R3 — P0 mobile (4–5 days)

- [ ] Port `AuthScreen`
- [ ] Move profile types to `@g88/shared/src/profile.ts`
- [ ] Port `Profile{Creation,Edit,View}Screen`
- [ ] Rebuild `InboxScreen` against new chat endpoints
- [ ] Port `ChatScreen` with socket-based send via `useSocket` ack
- [ ] Implement `AppNavigator` auth gate (`!authed` → Auth, `!profile.completedAt` → ProfileCreation, else Main)
- [ ] Port `Settings`/`Privacy` screens (logout + visibility toggle)
- [ ] Port `ErrorBoundary` + `ScreenErrorBoundary`

### Phase R4 — P1 hardening (3–4 days)

- [ ] **A1** — Opaque DB-stored rotating refresh tokens
- [ ] **A2** — `POST /auth/oauth/{google,apple}` endpoints
- [ ] **Pr1** — Emit `presence:delta` on cell migration
- [ ] **C5** — `conversation:join` handler
- [ ] **C6** — Mobile chat outbox
- [ ] Update `ARCHITECTURE.md` change log

---

## Definition of Done (P1)

All four must be true:

1. `pnpm install && pnpm --filter @g88/backend dev && pnpm --filter @g88/mobile android` boots an app that walks the full P1 flow on a clean DB: signup → profile → see map → send wave → reciprocal → chat → reconnect → message survives.
2. The synthetic CI check (signup → discovery → wave → message, every 5 min against staging) passes for 7 consecutive days.
3. A new contributor reading `README.md` + `ARCHITECTURE.md` + `STATUS.md` + `CLAUDE.md` gets one consistent story.
4. `legacy/` is read-only, excluded from CI, with a `legacy/README.md` explaining what's there and why nothing imports from it.

---

## Open Questions

Update these as decisions are made.

| # | Question | Default if no answer | Decided? |
|---|---|---|---|
| Q2 | Is anything in production today running against the old TypeORM schema? | No — `0001_initial.sql` is authoritative, greenfield | ❓ |
| Q4 | Apple + Google OAuth both for P1, or email-only + OAuth as fast-follow? | Both for P1 (App Store requirement) | ❓ |

---

## Risks Currently Tracked

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Legacy imports leak into `apps/` | M | M | CI lint rule on import paths |
| Schema drift between `legacy/backend/src/migrations/` and `apps/backend/migrations/0001_initial.sql` | M | H | `0001_initial.sql` is the only source; mark legacy migrations folder with `README.deprecated.md` |
| Half-ported features confuse the team | H | M | This file. Updated weekly. |
| `bestRecentMVP.html` keeps influencing engineering | M | L | Moved to `docs/marketing/` in R1 |
| FCM push for chat takes longer than estimated and blocks P1 ship | M | M | Feature-flag fallback to socket-only delivery; FCM ships as fast-follow if needed |
| OAuth complexity blows out auth timeline | M | M | Email/pw is the floor; OAuth slips to fast-follow if R4 runs long |

---

## Change Log

- **2026-05-14** — Initial draft. R1 not yet started. Reconciliation verdicts locked per `bestRecentMVP.html` → README supersession decision. Q1, Q3, Q5 answered (keep legacy in repo · FCM for waves+chat · draft CLAUDE.md + STATUS.md).
