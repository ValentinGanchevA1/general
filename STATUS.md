# STATUS — G88 Reconciliation & P1

> **Last updated:** 2026-05-20
> **Current phase:** R3 complete — P0 mobile done
> **Owner:** [your name]
>
> Update this file as work progresses. It's the single source of truth for "where are we?".

---

## P1 Critical Path

The only six things that must ship cleanly for "P1 done":

| # | Pillar | State | Blocker | Owner | Notes |
|---|---|---|---|---|---|
| 1 | **Auth** (email/pw + OAuth) | ⚠️ Partial | OAuth endpoints missing; refresh-token rotation not DB-stored | — | Email/pw works end-to-end; see `apps/backend/src/modules/auth/` |
| 2 | **Profile** | 🟦 Done | — | — | `PATCH /users/me/profile`, S3 presigned URL, ProfileCreation/Edit/Screen done |
| 3 | **Map discovery** | ✅ Shipping | None | — | H3 + server-side clustering done. Viewport-diff (1.5) deferred. |
| 4 | **Presence** | 🟦 Done | — | — | `presence:delta` emitted on cell boundary cross |
| 5 | **Wave** | 🟦 Done | — | — | Sender fully hydrated; FCM fallback wired |
| 6 | **Chat** | 🟦 Done | — | — | Persist + REST + mobile Inbox + ChatScreen |

**Legend:** ✅ shipping · ⚠️ partial · ❌ blocked / not started · 🟦 done & verified

---

## P0 Gap List (must close before P1 ships)

Ordered by critical-path impact. Each item maps to a file or absence-of-file.

| ID | Pillar | File | Gap | Fix size |
|---|---|---|---|---|
| C1 | Chat | `apps/backend/src/realtime/realtime.gateway.ts:onChatSend` | `id: 'TODO_persisted_id'` — messages emit but never persist | M | ✅ R2 |
| C2 | Chat | (missing) `apps/backend/src/modules/chat/chat.service.ts` | No service writes `messages` table | M | ✅ R2 |
| C3 | Chat | (missing) `apps/backend/src/modules/chat/chat.controller.ts` | No `GET /conversations`, `GET /conversations/:id/messages` | S | ✅ R2 |
| C4 | Chat | (missing) `apps/mobile/src/screens/{InboxScreen,ChatScreen}.tsx` | No mobile UI for chat | L | ✅ R3 |
| P1 | Profile | (missing) `apps/backend/src/modules/users/` | No `PATCH /users/me/profile`, no profile completion endpoint | M | ✅ R2 |
| P2 | Profile | (missing) `apps/mobile/src/screens/ProfileCreationScreen.tsx` | No mobile screen; auth gate in `AppNavigator` not implemented | L | ✅ R3 |
| P3 | Profile | (missing) `apps/backend/src/common/s3.service.ts` (or similar) | No presigned URL endpoint for avatar upload | S | ✅ R2 |
| W1 | Wave | `apps/backend/src/realtime/realtime.gateway.ts:emitWaveReceived` | Hardcodes `displayName: '', avatarUrl: null` — recipient sees empty notification | S | ✅ R2 |
| Pr1 | Presence | `apps/backend/src/realtime/realtime.gateway.ts` | No emitter for `presence:delta`. ZSETs updated; rooms joined; nothing broadcasts the delta. | M | ✅ R2 |

## P1 Gap List (close before public TestFlight)

| ID | Pillar | File | Gap | Fix size |
|---|---|---|---|---|
| A1 | Auth | `apps/backend/src/modules/auth/auth.service.ts` | Refresh tokens are stateless JWTs. Should be opaque, DB-stored, rotating, revocable per `ARCHITECTURE.md §5`. | L |
| A2 | Auth | `apps/backend/src/modules/auth/auth.controller.ts` | No `POST /auth/oauth/google` or `POST /auth/oauth/apple` endpoints. Apple required for App Store if any social login ships. | M |
| C5 | Chat | `apps/backend/src/realtime/realtime.gateway.ts` | `conversation:join` handler missing (`@SubscribeMessage('conversation:join')`) | S | ✅ R2 |
| N1 | Notifications | (missing) `apps/backend/src/modules/notifications/` | FCM token registration + send-on-offline for waves and chat | M | ✅ R2 |

## P2 (post-P1 hardening)

| ID | Pillar | Gap | Fix size |
|---|---|---|---|
| C6 | Chat | Mobile outbox — retry queue for messages sent during socket disconnect | M |
| M1 | Map | Viewport-diff protocol (`ARCHITECTURE.md §3.7`) — full responses on every pan are wasteful at city density | M |
| A3 | Auth | Hardcoded dev-secret fallbacks in `auth.service.ts` source — remove, require env vars in non-dev | S |
| A4 | Auth | `isAuthEndpoint` in `apps/mobile/src/api/client.ts` checks `/auth/signup`, backend uses `/auth/register`. Cosmetic. | XS | ✅ R3 |

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
| `profile/Profile{Creation,Edit}Screen` | PORT | ✅ R3 done | profileSlice, ProfileCreationScreen, ProfileEditScreen, ProfileScreen |
| `profile/types.ts` | REBUILD in `@g88/shared` | ✅ R2/R3 done | `UserProfile`, `UpdateProfileRequest` in `packages/shared/src/api.ts` |
| `chat/ChatScreen` | PORT | ✅ R3 done | ChatScreen with optimistic send + cursor pagination |
| `chat/chatSlice` | REBUILD | ✅ R3 done | Socket ack + REST fallback; `messageReceived / messageSentOptimistic / messageConfirmed` |
| `interactions/interactionsSlice` | DROP | n/a | Wave logic now lives in `MapScreen` directly |
| `verification/*` | DEFER | — | |
| `trading/*`, `gifts/*`, `gamification/*`, `events/*`, `trending/*`, `payments/*`, `market/*` | DEFER | — | |
| `notifications/NotificationsScreen` | PARTIAL PORT | DEFER | Not P0 |
| `inbox/InboxScreen` | REBUILD | ✅ R3 done | InboxScreen with enriched ConversationSummary + socket refresh |
| `settings/{Settings,Privacy}Screen` | PORT | ✅ R3 done | SettingsScreen: visibility toggle + logout |
| `components/ErrorBoundary`, `ScreenErrorBoundary` | PORT | ✅ R3 done | `apps/mobile/src/components/ErrorBoundary.tsx` |
| `components/ActionHub` (center FAB) | DEFER | — | P1 tab bar = Map · Inbox · Profile, no FAB |
| `components/VerificationBadge`, `SocialLinksDisplay` | DEFER | — | |
| `utils/eventBus` | reconciled | ✅ R3 done | `authEvents` in `client.ts` is the bus; no separate eventBus needed |
| `utils/logger` | DEFER | — | `console.*` used for now; production silencing is C3 debt |

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

### Phase R2 — P0 backend (3–4 days) — ✅ COMPLETE 2026-05-20

- [x] **P1, P3** — `apps/backend/src/modules/users/` + S3 presigned URL endpoint
- [x] **C2** — `apps/backend/src/modules/chat/chat.service.ts` (persist + last_message_at update)
- [x] **C3** — Chat REST endpoints
- [x] **C1** — Wire `chat.service.persist()` into `onChatSend`; kill `TODO_persisted_id`
- [x] **W1** — Hydrate wave sender in `emitWaveReceived` (lookup in InteractionsService, fully hydrated event passed to gateway)
- [x] **N1** — Notifications module: FCM registration + send-on-offline-emit-failure
- [x] **Pr1** — `presence:delta` emitted on cell boundary crossing
- [x] **C5** — `conversation:join` socket handler

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
