# STATUS — G88 Reconciliation & P1

> **Last updated:** 2026-05-22
> **Current phase:** R4 complete — all P1 pillars done
> **Owner:** [your name]
>
> Update this file as work progresses. It's the single source of truth for "where are we?".

---

## P1 Critical Path

The only six things that must ship cleanly for "P1 done":

| # | Pillar | State | Blocker | Owner | Notes |
|---|---|---|---|---|---|
| 1 | **Auth** (email/pw + OAuth) | 🟦 Done | — | — | Email/pw + Google OAuth; opaque DB-stored rotating refresh tokens; Apple OAuth deferred (fast-follow before App Store) |
| 2 | **Profile** | 🟦 Done | — | — | `PATCH /users/me/profile`, S3 presigned URL, ProfileCreation/Edit/Screen done |
| 3 | **Map discovery** | ✅ Shipping | None | — | H3 + server-side clustering done. Viewport-diff (1.5) deferred. |
| 4 | **Presence** | 🟦 Done | — | — | `presence:delta` emitted on cell boundary cross |
| 5 | **Wave** | 🟦 Done | — | — | Sender fully hydrated; FCM fallback wired |
| 6 | **Chat** | 🟦 Done | — | — | Persist + REST + mobile Inbox + ChatScreen |

**Legend:** ✅ shipping · ⚠️ partial · ❌ blocked / not started · 🟦 done & verified

---

## P0 Gap List (must close before P1 ships)

Ordered by critical-path impact. Each item maps to a file or absence-of-file.

| ID | Pillar | File | Gap | Fix size | |
|---|---|---|---|---|---|
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

| ID | Pillar | File | Gap | Fix size | |
|---|---|---|---|---|---|
| A1 | Auth | `apps/backend/src/modules/auth/auth.service.ts` | Refresh tokens are stateless JWTs. Should be opaque, DB-stored, rotating, revocable per `ARCHITECTURE.md §5`. | L | ✅ R4 |
| A2 | Auth | `apps/backend/src/modules/auth/auth.controller.ts` | No `POST /auth/oauth/google`. Apple deferred — required before App Store if social login ships. | M | ✅ R4 (Google); Apple = fast-follow |
| C5 | Chat | `apps/backend/src/realtime/realtime.gateway.ts` | `conversation:join` handler missing (`@SubscribeMessage('conversation:join')`) | S | ✅ R2 |
| N1 | Notifications | (missing) `apps/backend/src/modules/notifications/` | FCM token registration + send-on-offline for waves and chat | M | ✅ R2 |

## P2 (post-P1 hardening)

| ID | Pillar | Gap | Fix size | |
|---|---|---|---|---|
| A3 | Auth | Apple Sign-In (`POST /auth/oauth/apple`) — required by App Store before any social login ships | M | next up |
| C6 | Chat | Mobile outbox — retry queue for messages sent during socket disconnect | M | |
| M1 | Map | Viewport-diff protocol (`ARCHITECTURE.md §3.7`) — full responses on every pan are wasteful at city density | M | |
| A4 | Auth | Hardcoded dev-secret fallbacks in `auth.service.ts` source — remove, require env vars in non-dev | S | |
| OB1 | Observability | Sentry on both apps — minimum bar before public TestFlight (C3 critical debt) | M | |

**Fix size legend:** XS <1h · S 1–4h · M 0.5–1d · L 1–3d

---

## Reconciliation Verdicts (legacy → `apps/`)

### Backend modules

| Legacy module | Verdict | Status | Notes |
|---|---|---|---|
| `auth` | REBUILD | ✅ done | Email/pw + Google OAuth; opaque rotating refresh tokens; Apple OAuth P2 |
| `users` | REBUILD | ✅ done | `PATCH /users/me/profile`, S3 presigned upload, profile completion |
| `locations` | DROP | n/a | Replaced by `discovery` + `presence` |
| `discovery` (swipe deck) | DROP | n/a | New `discovery` is map-nearby; old swipe is a future dating feature |
| `chat` | REBUILD | ✅ done | Persist + REST endpoints + socket gateway |
| `interactions` (waves) | REBUILD | ✅ done | Sender hydration + FCM push fallback |
| `events` | DEFER | — | Schema already in `0001_initial.sql` |
| `social` (follow/unfollow) | DEFER | — | |
| `payments` (Stripe) | DEFER | — | |
| `verification` (phone/photo/ID) | DEFER | — | Only `verification_level` enum survives |
| `notifications` | PARTIAL REBUILD | ✅ done | FCM token registration + send-on-offline; geofences deferred |
| `analytics` / `trending` | DROP | n/a | |
| `gamification` | DROP | n/a | |
| `gifts` | DROP | n/a | |
| `trading` | DEFER | — | `listings` table already in schema |
| `skills` (scores) | DROP | n/a | |
| `admin` | DEFER | — | Audit log table stays in schema |

### Mobile screens

| Legacy feature | Verdict | Status | Notes |
|---|---|---|---|
| `auth/AuthScreen` | PORT | ✅ R3 done | Email/pw + Google OAuth button; auth gate in AppNavigator |
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

### Phase R1 — Reconcile (0.5d) — ✅ COMPLETE 2026-05-14

- [x] Move `mobile/` + `backend/` under `legacy/`
- [x] Update `pnpm-workspace.yaml` to exclude `legacy/**`
- [x] Tag: `git tag legacy-freeze-2026-05-14`
- [x] Add CI lint rule rejecting any import path containing `legacy/`
- [x] Move `bestRecentMVP.html` into `docs/marketing/`
- [x] Replace `CLAUDE.md` with the new version
- [x] Commit `STATUS.md` (this file)

### Phase R2 — P0 backend (3–4 days) — ✅ COMPLETE 2026-05-20

- [x] **P1, P3** — `apps/backend/src/modules/users/` + S3 presigned URL endpoint
- [x] **C2** — `apps/backend/src/modules/chat/chat.service.ts` (persist + last_message_at update)
- [x] **C3** — Chat REST endpoints
- [x] **C1** — Wire `chat.service.persist()` into `onChatSend`; kill `TODO_persisted_id`
- [x] **W1** — Hydrate wave sender in `emitWaveReceived`
- [x] **N1** — Notifications module: FCM registration + send-on-offline-emit-failure
- [x] **Pr1** — `presence:delta` emitted on cell boundary crossing
- [x] **C5** — `conversation:join` socket handler

### Phase R3 — P0 mobile (4–5 days) — ✅ COMPLETE 2026-05-20

- [x] Port `AuthScreen` (email/pw; Google OAuth added in R4)
- [x] Move profile types to `@g88/shared`
- [x] Port `Profile{Creation,Edit,View}Screen`
- [x] Rebuild `InboxScreen` against new chat endpoints
- [x] Port `ChatScreen` with socket-based send via `useSocket` ack
- [x] Implement `AppNavigator` auth gate
- [x] Port `Settings`/`Privacy` screens (logout + visibility toggle)
- [x] Port `ErrorBoundary` + `ScreenErrorBoundary`

### Phase R4 — P1 hardening — ✅ COMPLETE 2026-05-21

- [x] **A1** — Opaque DB-stored rotating refresh tokens (`0003_refresh_tokens.sql`)
- [x] **A2** — `POST /auth/oauth/google` + mobile `loginWithGoogle` thunk + AuthScreen button (`0004_oauth.sql`)
- [x] Android CI workflow with Maps key injection from secrets (`android-build.yml`)
- [x] Fix `.gitignore` for `android/app/.cxx/` — untracked 514 build artifacts
- [x] Patch 10/10 Dependabot vulnerabilities via pnpm overrides (uuid last, closed 2026-05-22)
- [x] pnpm 11 migration: move `overrides` + `onlyBuiltDependencies` from `package.json` to `pnpm-workspace.yaml`; bump Node 22 in all CI workflows; fix `gradlew` execute bit; opt into Node.js 24 action runners
- [ ] **A3** — Apple Sign-In (`POST /auth/oauth/apple`) — P2, required before App Store submission
- [ ] **C6** — Mobile chat outbox (P2)
- [x] Update `ARCHITECTURE.md` change log

---

## Definition of Done (P1)

All four must be true:

1. `pnpm install && pnpm --filter @g88/backend dev && pnpm --filter @g88/mobile android` boots an app that walks the full P1 flow on a clean DB: signup → profile → see map → send wave → reciprocal → chat → reconnect → message survives.
2. The synthetic CI check (signup → discovery → wave → message, every 5 min against staging) passes for 7 consecutive days.
3. A new contributor reading `README.md` + `ARCHITECTURE.md` + `STATUS.md` + `CLAUDE.md` gets one consistent story.
4. `legacy/` is read-only, excluded from CI, with a `legacy/README.md` explaining what's there and why nothing imports from it.

---

## Open Questions

| # | Question | Default if no answer | Decided? |
|---|---|---|---|
| Q2 | Is anything in production today running against the old TypeORM schema? | No — `0001_initial.sql` is authoritative, greenfield | ❓ |
| Q4 | Apple Sign-In for P1 or fast-follow? | Fast-follow — ship Google-only first, add Apple before App Store review | ✅ decided 2026-05-21 |

---

## Risks Currently Tracked

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Legacy imports leak into `apps/` | L | M | CI lint rule on import paths — enforced |
| Schema drift between `legacy/backend/src/migrations/` and `apps/backend/migrations/0001_initial.sql` | L | H | `0001_initial.sql` is the only source; legacy migrations are read-only reference |
| Half-ported features confuse the team | L | M | This file. Updated as work completes. |
| Apple Sign-In missing at App Store submission | H | H | Tracked as A3 P2 — must ship before any social login goes live on iOS |
| No production observability (C3 critical debt) | H | H | Tracked as OB1 P2 — Sentry minimum bar before public TestFlight |
| Config.GOOGLE_WEB_CLIENT_ID placeholder not replaced before first run | M | H | TODO comment in `apps/mobile/src/config.ts`; `GOOGLE_CLIENT_ID` required in backend `.env` |

---

## Change Log

- **2026-05-14** — Initial draft. R1 not yet started. Reconciliation verdicts locked.
- **2026-05-20** — R2 (P0 backend) + R3 (P0 mobile) complete.
- **2026-05-21** — R4 complete. All six P1 pillars done. A1 (opaque refresh tokens) + A2 (Google OAuth) shipped. Apple OAuth deferred to P2 (A3). Android CI, .gitignore, and Dependabot fixes also landed.
- **2026-05-22** — CI/tooling hardening. Migrated to pnpm 11 (workspace settings to `pnpm-workspace.yaml`). Bumped Node 22 (required by pnpm 11). Opted into Node.js 24 GitHub Actions runners ahead of June 2 deadline. Fixed `gradlew` execute bit (Android Build now green). Closed final Dependabot alert (uuid → 11.1.1, all 10/10 resolved).
