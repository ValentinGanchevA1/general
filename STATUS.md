# STATUS — G88 Reconciliation & P1

> **Last updated:** 2026-06-10
> **Current phase:** P5 feature build-out — **Gifts (XP-funded, v1)** ✅ shipped end-to-end (backend + mobile + realtime/push), Challenges mobile screen shipped, **ID-document verification (manual review)** wired end-to-end (`0020`/`0021`, applied to prod 2026-06-09; app wiring committed 2026-06-10). P4 profile & monetization surface (G1–G5) code-complete; **all migrations applied to prod through `0021`**; **G2 (Twilio) + G3 (Stripe, test mode) creds landed 2026-06-05** (pending live verify), G4 social deferred. Apple Sign-In (A3) removed from scope 2026-06-05 (0019 applied). **CI Backend/Mobile jobs fixed 2026-06-05 — repo CI green.** P2 7-day synthetic gate clears 2026-06-06.
> **Owner:** [your name]
>
> Update this file as work progresses. It's the single source of truth for "where are we?".

---

## P1 Critical Path

The only six things that must ship cleanly for "P1 done":

| # | Pillar                      | State   | Blocker | Owner | Notes                                                                                                                  |
|---|-----------------------------|---------|---------|-------|------------------------------------------------------------------------------------------------------------------------|
| 1 | **Auth** (email/pw + OAuth) | 🟦 Done | —       | —     | Email/pw + Google OAuth; opaque DB-stored rotating refresh tokens. Apple Sign-In removed from scope 2026-06-05 (see App Store risk below) |
| 2 | **Profile**                 | 🟦 Done | —       | —     | `PATCH /users/me/profile`, S3 presigned URL, ProfileCreation/Edit/Screen done                                          |
| 3 | **Map discovery**           | 🟦 Done | —       | —     | H3 + server-side clustering + viewport-diff (M1) done.                                                                 |
| 4 | **Presence**                | 🟦 Done | —       | —     | `presence:delta` emitted on cell boundary cross                                                                        |
| 5 | **Wave**                    | 🟦 Done | —       | —     | Sender fully hydrated; FCM fallback wired                                                                              |
| 6 | **Chat**                    | 🟦 Done | —       | —     | Persist + REST + mobile Inbox + ChatScreen + outbox retry (C6)                                                         |

**Legend:** ✅ shipping · ⚠️ partial · ❌ blocked / not started · 🟦 done & verified

---

## P0 Gap List (must close before P1 ships)

Ordered by critical-path impact. Each item maps to a file or absence-of-file.

| ID  | Pillar   | File                                                             | Gap                                                                                         | Fix size |      |
|-----|----------|------------------------------------------------------------------|---------------------------------------------------------------------------------------------|----------|------|
| C1  | Chat     | `apps/backend/src/realtime/realtime.gateway.ts:onChatSend`       | `id: 'TODO_persisted_id'` — messages emit but never persist                                 | M        | ✅ R2 |
| C2  | Chat     | (missing) `apps/backend/src/modules/chat/chat.service.ts`        | No service writes `messages` table                                                          | M        | ✅ R2 |
| C3  | Chat     | (missing) `apps/backend/src/modules/chat/chat.controller.ts`     | No `GET /conversations`, `GET /conversations/:id/messages`                                  | S        | ✅ R2 |
| C4  | Chat     | (missing) `apps/mobile/src/screens/{InboxScreen,ChatScreen}.tsx` | No mobile UI for chat                                                                       | L        | ✅ R3 |
| P1  | Profile  | (missing) `apps/backend/src/modules/users/`                      | No `PATCH /users/me/profile`, no profile completion endpoint                                | M        | ✅ R2 |
| P2  | Profile  | (missing) `apps/mobile/src/screens/ProfileCreationScreen.tsx`    | No mobile screen; auth gate in `AppNavigator` not implemented                               | L        | ✅ R3 |
| P3  | Profile  | (missing) `apps/backend/src/common/s3.service.ts` (or similar)   | No presigned URL endpoint for avatar upload                                                 | S        | ✅ R2 |
| W1  | Wave     | `apps/backend/src/realtime/realtime.gateway.ts:emitWaveReceived` | Hardcodes `displayName: '', avatarUrl: null` — recipient sees empty notification            | S        | ✅ R2 |
| Pr1 | Presence | `apps/backend/src/realtime/realtime.gateway.ts`                  | No emitter for `presence:delta`. ZSETs updated; rooms joined; nothing broadcasts the delta. | M        | ✅ R2 |

## P1 Gap List (close before public TestFlight)

| ID | Pillar        | File                                                | Gap                                                                                                           | Fix size |                                    |
|----|---------------|-----------------------------------------------------|---------------------------------------------------------------------------------------------------------------|----------|------------------------------------|
| A1 | Auth          | `apps/backend/src/modules/auth/auth.service.ts`     | Refresh tokens are stateless JWTs. Should be opaque, DB-stored, rotating, revocable per `ARCHITECTURE.md §5`. | L        | ✅ R4                               |
| A2 | Auth          | `apps/backend/src/modules/auth/auth.controller.ts`  | No `POST /auth/oauth/google`.                                                                                 | M        | ✅ R4 (Google)                       |
| C5 | Chat          | `apps/backend/src/realtime/realtime.gateway.ts`     | `conversation:join` handler missing (`@SubscribeMessage('conversation:join')`)                                | S        | ✅ R2                               |
| N1 | Notifications | (missing) `apps/backend/src/modules/notifications/` | FCM token registration + send-on-offline for waves and chat                                                   | M        | ✅ R2                               |

## P2 (post-P1 hardening)

| ID     | Pillar        | Gap                                                                                                        | Fix size |                                                                                                                |
|--------|---------------|------------------------------------------------------------------------------------------------------------|----------|----------------------------------------------------------------------------------------------------------------|
| A3     | Auth          | ~~Apple Sign-In (`POST /auth/oauth/apple`)~~ — **removed from scope 2026-06-05**                           | —        | ❌ removed (code, deps, migration 0009 reverted by 0019 — **applied to prod 2026-06-05**). See App Store risk re: shipping Google without Apple on iOS. |
| C6     | Chat          | Mobile outbox — retry queue for messages sent during socket disconnect                                     | M        | ✅ done                                                                                                         |
| M1     | Map           | Viewport-diff protocol (`ARCHITECTURE.md §3.7`) — full responses on every pan are wasteful at city density | M        | ✅ done                                                                                                         |
| A4     | Auth          | Hardcoded dev-secret fallbacks in `auth.service.ts` source — remove, require env vars in non-dev           | S        | ✅ done                                                                                                         |
| OB1    | Observability | Sentry on both apps — minimum bar before public TestFlight (C3 critical debt)                              | M        | ✅ done                                                                                                         |
| DEPLOY | Infra         | Render web services (`g88-api.onrender.com`) + Redis; **Postgres on Supabase** (`DATABASE_URL`)            | M        | ✅ done 2026-05-30                                                                                              |
| MON    | CI            | Synthetic P1 monitor (`scripts/synthetic-monitor.mjs`, cron `*/5 * * * *`) — 7-day gate for DoD item 2     | M        | ✅ running — clock started 2026-05-30                                                                           |

**Fix size legend:** XS <1h · S 1–4h · M 0.5–1d · L 1–3d

---

## P3 (feature build-out)

First post-hardening features. All wired fire-and-forget so they never block the core action.

| ID              | Pillar        | Deliverable                                                                                                                                                                                                                                                                                                                        | Migration                    | State        |
|-----------------|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|--------------|
| Push            | Notifications | FCM chat push + mobile setup (migrated to `@react-native-firebase` v22 modular API); deep-link routing                                                                                                                                                                                                                             | —                            | ✅ 2026-05-31 |
| P3 #3           | Notifications | Geofence-triggered alert pushes — `notifyGeofenceMatch` pre-filters with `gridDisk(alertCell, 3)` then confirms exact ring membership; skips author; fired on alert create                                                                                                                                                         | 0007/0008 (alerts/geofences) | ✅ 2026-05-31 |
| P3 #1           | Gamification  | XP ledger (idempotent + daily-capped), levels (`50*(L-1)²` curve), daily streak; awards wired into match + alert-post                                                                                                                                                                                                              | 0010                         | ✅ 2026-05-31 |
| P3 #1 (slice 2) | Gamification  | Daily challenges — 6-challenge catalog, 3/day chosen by seeded date shuffle, per-user/day progress, bonus XP via ledger; `GET /challenges/today`; ProfileScreen card                                                                                                                                                               | 0011                         | ✅ 2026-05-31 |
| P5 #1           | Gamification  | **Gifts (XP-funded, v1)** — dual-balance wallet (`spendable_xp` decoupled from lifetime `total_xp`), atomic row-locked spend, capped `gift.received` reward; catalog/balance/received/send; mobile send sheet + inbox + chat affordance; realtime `gift:received` + offline push. **No refund/undo in v1** (a sent gift is final). | 0018_gifts                   | ✅ 2026-06-04 |
| P5 #2           | Gamification  | Challenges **mobile screen** — real `ChallengesScreen` over the existing `GET /challenges/today` (replaces the "Coming soon" placeholder)                                                                                                                                                                                          | — (uses 0011)                | ✅ 2026-06-04 |

**Apple Sign-In (A3): removed from scope 2026-06-05.** All backend (`POST /auth/oauth/apple`, `appleOAuth`, `AppleOAuthDto`), mobile (`loginWithApple`, AuthScreen button), the `apple-signin-auth` / `@invertase/react-native-apple-authentication` deps, the iOS entitlements scaffold, and the `apple_sub` column (migration 0009, reverted by 0019) were deleted. **App Store caveat:** Apple requires Sign in with Apple if an app offers any other social login. Google OAuth is live, so an iOS App Store build must either re-add Apple, drop Google on iOS, or go email-only on iOS. Moot while the product is Android-first.

---

## P4 — Profile & monetization surface (G1–G5)

Rich ProfileScreen redesign + the data and integrations behind it. Code-complete and on `master`; each integration is **env-gated** and inert until its credentials land (mirrors the FCM/Sentry pattern).

| ID | Pillar        | Deliverable                                                                                                                                                                                                                                                 | Migration                    | State                                                  |
|----|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|--------------------------------------------------------|
| G1 | Profile       | Rich ProfileScreen (hero photo, badges, verification bar, sections, menu); `users` + phone/dob/subscription_tier/interests; `user_photos` + `social_links`; UserProfile gains photoUrls/age/subscriptionTier/socialLinks + derived verificationScore/badges | 0012_profile_expansion       | ✅                                                      |
| G2 | Verification  | Twilio Verify phone OTP — `POST /verification/phone/{start,check}`, ladder promotion, unique verified phone, dev fallback code; VerificationScreen                                                                                                          | 0013                         | ✅ code; **creds landed 2026-06-05** (`TWILIO_*` set on `g88-api`); ⏳ pending live verify |
| G3 | Subscriptions | Stripe checkout + billing portal + signature-verified webhook → `subscription_tier`; SubscriptionScreen (hosted Checkout via Linking); `main.ts` rawBody                                                                                                    | 0014                         | ✅ code; **creds landed 2026-06-05** (`STRIPE_*` + test webhook `we_1TewGyQrMz3BrdsU1vKbM2JL` set on `g88-api`, **test mode**); ⏳ pending live verify |
| G4 | Social        | Provider-generic OAuth linking (instagram/twitter/tiktok/facebook/linkedin/spotify), HMAC-signed-state server-side callback; SocialLinkingScreen                                                                                                            | — (uses 0012 `social_links`) | ✅ code; needs per-provider creds; X/Twitter needs PKCE |
| G5 | Gamification  | Achievements + Leaderboard **mobile** screens over the existing backend (catalog, unlock evaluation wired into wave-match + alert-post, `GET /achievements`, `GET /gamification/leaderboard`)                                                               | 0015_achievements            | ✅                                                      |

**Deploy checklist (P4):**
- ✅ **Migrations** — 0001–0021 all applied to prod Supabase (0001–0018 verified 2026-06-05; 0019 applied 2026-06-05; 0020/0021 applied 2026-06-09, verified 2026-06-10).
- ✅ **G2 Twilio (2026-06-05)** — `TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID` set on `g88-api`.
- ✅ **G3 Stripe (2026-06-05, test mode)** — `STRIPE_SECRET_KEY` (`sk_test_`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC` (`price_1TdFbRQrMz3BrdsUdNVcUPHm`), `STRIPE_PRICE_PREMIUM` (`price_1TdFceQrMz3BrdsUvK1RsKTo`) set on `g88-api`. Test webhook `we_1TewGyQrMz3BrdsU1vKbM2JL` → `/api/v1/subscriptions/webhook` (events: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`). Optional `STRIPE_*_URL` vars left at code defaults.
- ⏳ **Pending live verify** — phone OTP SMS (G2) and checkout→webhook→`subscription_tier` flip (G3) not yet exercised against the new deploy.
- ⬜ **G4 Social** — deferred 2026-06-05 (no provider creds landed); needs `{PROVIDER}_CLIENT_ID/SECRET` + `API_PUBLIC_URL` + `SOCIAL_LINK_RETURN_URL` + provider redirects → `/api/v1/social/callback`.

**VIP tier removed** (migration 0016). Earlier note: subscriptions previously returned `cs_test_` URLs in an earlier test-mode check.

> **Migrations:** all 0001–0015 are idempotent (guarded DDL). The former `0012` prefix collision is resolved — the achievements migration moved to `0015_achievements.sql` (no deps, latest feature), while `0012_profile_expansion` stays ahead of `0013`/`0014` which depend on its columns. `schema_migrations` rows renamed in lockstep. **All migrations through `0021` are applied to prod Supabase** (`0001`–`0019` verified live 2026-06-05; `0020`/`0021` applied 2026-06-09, verified 2026-06-10). Next free number is `0022` (`0016` = drop VIP tier, `0017` = message requests, `0018` = gifts, `0019` = drop Apple OAuth, `0020` = ID-verification schema, `0021` = discovery view `verifiedBadge`). ⚠️ `0020` is **not** idempotent (raw `CREATE TYPE`/`ADD COLUMN`, no guards) — already applied, do not re-run.

---

## Reconciliation Verdicts (legacy → `apps/`)

### Backend modules

| Legacy module                   | Verdict         | Status  | Notes                                                                                                                                                                                           |
|---------------------------------|-----------------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `auth`                          | REBUILD         | ✅ done  | Email/pw + Google OAuth; opaque rotating refresh tokens. Apple OAuth removed 2026-06-05                                                                                                         |
| `users`                         | REBUILD         | ✅ done  | `PATCH /users/me/profile`, S3 presigned upload, profile completion                                                                                                                              |
| `locations`                     | DROP            | n/a     | Replaced by `discovery` + `presence`                                                                                                                                                            |
| `discovery` (swipe deck)        | DROP            | n/a     | New `discovery` is map-nearby; old swipe is a future dating feature                                                                                                                             |
| `chat`                          | REBUILD         | ✅ done  | Persist + REST endpoints + socket gateway                                                                                                                                                       |
| `interactions` (waves)          | REBUILD         | ✅ done  | Sender hydration + FCM push fallback                                                                                                                                                            |
| `events`                        | DEFER           | —       | Schema already in `0001_initial.sql`                                                                                                                                                            |
| `social` (follow/unfollow)      | DEFER           | —       | Follow graph still deferred. Separate: social **account linking** (OAuth, 6 providers) shipped P4/G4.                                                                                           |
| `payments` (Stripe)             | DEFER → PARTIAL | ✅ P4    | Subscriptions shipped P4/G3 (checkout + portal + webhook → `subscription_tier`). Connect/commerce escrow still deferred.                                                                        |
| `verification` (phone/photo/ID) | DEFER → PARTIAL | ✅ P4    | Phone OTP via Twilio shipped P4/G2 (promotes ladder to `phone`). selfie/ID + Rekognition still deferred.                                                                                        |
| `notifications`                 | PARTIAL REBUILD | ✅ done  | FCM token registration + send-on-offline; chat push + geofence-triggered alert pushes shipped (P3, 2026-05-31)                                                                                  |
| `analytics` / `trending`        | DROP            | n/a     |                                                                                                                                                                                                 |
| `gamification`                  | DROP → REBUILD  | ✅ P3/P4 | Rebuilt fresh: XP ledger, levels, streak, daily challenges (P3); achievements + leaderboard backend & mobile screens (P4/G5). Not ported from legacy.                                           |
| `gifts`                         | DROP → REBUILD  | ✅ P5    | Rebuilt fresh as XP-funded v1 (not ported from legacy): dual-balance wallet, atomic spend, capped recipient reward, send/inbox, realtime + offline push (migration 0018). No refund/undo in v1. |
| `trading`                       | DEFER           | —       | `listings` table already in schema                                                                                                                                                              |
| `skills` (scores)               | DROP            | n/a     |                                                                                                                                                                                                 |
| `admin`                         | DEFER           | —       | Audit log table stays in schema                                                                                                                                                                 |

### Mobile screens

| Legacy feature                                                                    | Verdict                  | Status       | Notes                                                                                                           |
|-----------------------------------------------------------------------------------|--------------------------|--------------|-----------------------------------------------------------------------------------------------------------------|
| `auth/AuthScreen`                                                                 | PORT                     | ✅ R3 done    | Email/pw + Google OAuth button; auth gate in AppNavigator                                                       |
| `map/*`                                                                           | DROP                     | n/a          | New `apps/mobile/src/screens/MapScreen.tsx` is better                                                           |
| `discovery/*` (swipe)                                                             | DEFER                    | —            |                                                                                                                 |
| `profile/Profile{Creation,Edit}Screen`                                            | PORT                     | ✅ R3 done    | profileSlice, ProfileCreationScreen, ProfileEditScreen, ProfileScreen                                           |
| `profile/types.ts`                                                                | REBUILD in `@g88/shared` | ✅ R2/R3 done | `UserProfile`, `UpdateProfileRequest` in `packages/shared/src/api.ts`                                           |
| `chat/ChatScreen`                                                                 | PORT                     | ✅ R3 done    | ChatScreen with optimistic send + cursor pagination                                                             |
| `chat/chatSlice`                                                                  | REBUILD                  | ✅ R3 done    | Socket ack + REST fallback; `messageReceived / messageSentOptimistic / messageConfirmed`                        |
| `interactions/interactionsSlice`                                                  | DROP                     | n/a          | Wave logic now lives in `MapScreen` directly                                                                    |
| `verification/*`                                                                  | DEFER                    | —            |                                                                                                                 |
| `gifts/*`                                                                         | REBUILD                  | ✅ P5 done    | XP-funded v1: `features/gifts/` (hooks + SendGiftSheet), `GiftsInboxScreen`; entry points on UserProfile + Chat |
| `trading/*`, `gamification/*`, `events/*`, `trending/*`, `payments/*`, `market/*` | DEFER                    | —            | (gamification + trending since shipped P3/P4; row pending cleanup)                                              |
| `notifications/NotificationsScreen`                                               | PARTIAL PORT             | DEFER        | Not P0                                                                                                          |
| `inbox/InboxScreen`                                                               | REBUILD                  | ✅ R3 done    | Superseded by PulseScreen (R5). Rollback file removed 2026-05-23.                                               |
| `settings/{Settings,Privacy}Screen`                                               | PORT                     | ✅ R3 done    | SettingsScreen: visibility toggle + logout                                                                      |
| `components/ErrorBoundary`, `ScreenErrorBoundary`                                 | PORT                     | ✅ R3 done    | `apps/mobile/src/components/ErrorBoundary.tsx`                                                                  |
| `components/ActionHub` (center FAB)                                               | REBUILD                  | ✅ R5 done    | FAB + bottom-sheet launcher; navigates to Pulse tab with filter preset                                          |
| `components/VerificationBadge`, `SocialLinksDisplay`                              | DEFER                    | —            |                                                                                                                 |
| `utils/eventBus`                                                                  | reconciled               | ✅ R3 done    | `authEvents` in `client.ts` is the bus; no separate eventBus needed                                             |
| `utils/logger`                                                                    | DEFER                    | —            | `console.*` used for now; production silencing is C3 debt                                                       |

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

### Phase R5 — Pulse v1 — ✅ COMPLETE 2026-05-23

- [x] `packages/shared/src/activity.ts` — `ActivityItem`, `ActivityType`, `FeedResponse` shared types
- [x] `GET /api/v1/feed` — `FeedService` aggregates chats + waves (schema-aware: recipient via `participant_ids`, unread heuristic, `responded_at` for waves)
- [x] `FeedModule` registered in `AppModule`
- [x] `pulseSlice` — async thunk over `/feed` with `since`/`types` params
- [x] `PulseScreen` — filter chips (All / Chats / Waves / Trades / Alerts / Matches), pull-to-refresh, deep-link tap routing
- [x] `ActionHub` FAB — bottom-sheet launcher; tapping an action navigates to Pulse tab with filter preset
- [x] Tab bar renamed: Map · **Pulse** · Profile (InboxScreen kept as rollback safety)
- [x] 3 backend tests + 5 mobile tests passing; both typechecks clean

### Phase R4 — P1 hardening — ✅ COMPLETE 2026-05-21

- [x] **A1** — Opaque DB-stored rotating refresh tokens (`0003_refresh_tokens.sql`)
- [x] **A2** — `POST /auth/oauth/google` + mobile `loginWithGoogle` thunk + AuthScreen button (`0004_oauth.sql`)
- [x] `0002_profile_fields.sql` — adds `bio TEXT` to `users`; profile completion = bio + avatar_url both non-null
- [x] `0005_h3_not_null_backfill.sql` — H3 cell completeness constraint on `users`; NOT NULL enforcement on `events`/`listings`; missing r4/r6/r8 indexes added
- [x] Android CI workflow with Maps key injection from secrets (`android-build.yml`)
- [x] Fix `.gitignore` for `android/app/.cxx/` — untracked 514 build artifacts
- [x] Patch 10/10 Dependabot vulnerabilities via pnpm overrides (uuid last, closed 2026-05-22)
- [x] pnpm 11 migration: move `overrides` + `onlyBuiltDependencies` from `package.json` to `pnpm-workspace.yaml`; bump Node 22 in all CI workflows; fix `gradlew` execute bit; opt into Node.js 24 action runners
- [x] **C6** — Mobile chat outbox (P2) — `outbox[]` + `failedIds[]` in chatSlice; drain on reconnect; ⏱/retry UI
- [x] **M1** — Viewport-diff (P2) — snapshot in Redis (30s TTL); diff returned when prevViewportHash valid
- [x] ~~**A3** — Apple Sign-In (P2)~~ — **removed from scope 2026-06-05** (code + deps + migration reverted)
- [x] Update `ARCHITECTURE.md` change log

---

## Definition of Done (P1)

All four must be true:

1. ✅ `pnpm install && pnpm --filter @g88/backend dev && pnpm --filter @g88/mobile android` boots an app that walks the full P1 flow on a clean DB: signup → profile → see map → send wave → reciprocal → chat → reconnect → message survives.
2. ⏳ The synthetic CI check (signup → discovery → wave → message, every 5 min against prod) passes for 7 consecutive days. **Clock started 2026-05-30 — gate clears 2026-06-06.**
3. ⚠️ A new contributor reading `README.md` + `ARCHITECTURE.md` + `STATUS.md` + `CLAUDE.md` gets one consistent story. *(STATUS.md updated 2026-05-30; ARCHITECTURE.md change log needs a 2026-05-30 entry for C6/M1/deploy.)*
4. ✅ `legacy/` is read-only, excluded from CI, with a `legacy/README.md` explaining what's there and why nothing imports from it.

---

## Open Questions

| #  | Question                                                                | Default if no answer                                       | Decided?             |
|----|-------------------------------------------------------------------------|------------------------------------------------------------|----------------------|
| Q2 | Is anything in production today running against the old TypeORM schema? | No — `0001_initial.sql` is authoritative, greenfield       | ❓                    |
| Q4 | Apple Sign-In for P1 or fast-follow?                                    | Removed from scope 2026-06-05 — not shipping Apple Sign-In | ✅ decided 2026-06-05 |

---

## Risks Currently Tracked

| Risk                                                                                                 | Likelihood | Impact | Mitigation                                                                                                                                                                                                                    |
|------------------------------------------------------------------------------------------------------|------------|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Legacy imports leak into `apps/`                                                                     | L          | M      | CI lint rule on import paths — enforced                                                                                                                                                                                       |
| Schema drift between `legacy/backend/src/migrations/` and `apps/backend/migrations/0001_initial.sql` | L          | H      | `0001_initial.sql` is the only source; legacy migrations are read-only reference                                                                                                                                              |
| Half-ported features confuse the team                                                                | L          | M      | This file. Updated as work completes.                                                                                                                                                                                         |
| iOS App Store rejection — Google login shipped without Sign in with Apple                            | H          | H      | Apple mandates Sign in with Apple when any other social login is offered. Apple Sign-In removed 2026-06-05. Before any iOS submission: re-add Apple, drop Google on iOS, or go email-only on iOS. Android-first, so deferred. |
| No production observability (C3 critical debt)                                                       | L          | M      | ✅ Mitigated — Sentry wired on both apps (OB1 done)                                                                                                                                                                            |
| Config.GOOGLE_WEB_CLIENT_ID placeholder not replaced before first run                                | L          | M      | ✅ Mitigated — set in `apps/mobile/.env` and `GOOGLE_CLIENT_ID` set in Render dashboard                                                                                                                                        |
| Render free tier cold starts (~55s) inflate synthetic monitor P99                                    | M          | L      | Acceptable at MVP — upgrade to Starter plan before TestFlight                                                                                                                                                                 |

---

## Change Log

- **2026-06-10** — **ID-document verification wired live + docs reconciled.** The feature commit (`f5b3dca`, 2026-06-07) added the `id-verification` backend module, `VerificationIdScreen`, `idVerificationSlice`, and migrations `0020`/`0021` — but left the **activation wiring uncommitted**, so on `master` the feature was dead: `IdVerificationModule` was imported but never registered in `AppModule.imports` (endpoints `/verification/id/*` un-mounted), and the mobile screen had no nav route or entry point. Committed the wiring (`cde65fa`): module registered, `VerificationId` route added (modal), ProfileScreen ID-verification status card + "Verify now" entry. Typecheck/lint/test all green (backend 23/23, mobile 25/25). **DB:** migrations `0020` (id_verification enum/column + `user_id_verifications` table) and `0021` (`v_discoverable_entity` view gains `verifiedBadge`) were found **already applied to prod** (2026-06-09 08:45 UTC) — verified live, no action needed; STATUS/CLAUDE corrected from the stale "through 0019". Updated `CLAUDE.md` codebase section (migration range `0001`–`0021`/next `0022`, Verification stack row, module list adds `id-verification`+`alerts`). **Known gaps (carried):** (1) no `pending→verified` path in code — review is manual DB-only, so the verified badge is unreachable without an admin/review tool; (2) `id-verification` module has **no `.spec.ts`** (violates the C2 ≥1-spec-per-module gate); (3) mobile S3-key extraction string-splits the presigned URL (fragile for path-style URLs).
- **2026-06-05** — **Multi-photo gallery (profile) — backend write path + mobile management.** The display side already existed (ProfileScreen renders `photoUrls`, `user_photos` table from 0012, presigned-avatar endpoint), but there was **no way to add photos** — no write endpoints, no picker, ProfileEdit only touched name/bio. **No migration** (table already present). **Backend:** `S3Service.photoPresignedUrl` (generalized the avatar presign into a private `presign(prefix,…)`); `UsersService.listPhotos/addPhoto/deletePhoto/reorderPhotos` with a 6-photo cap and a `syncAvatar` invariant — **position-0 photo is the avatar**, kept in sync on add(first)/delete/reorder via a single atomic `UPDATE … FROM (VALUES …)`. New `/users/me/photos` REST surface: `GET`, `POST presigned-url`, `POST` (register url), `PATCH order`, `DELETE :photoId` (all before the `:id` catch-all). 7 new `users.service.spec` tests (cap, not-found, reorder-mismatch, avatar sync). **Shared:** `UserPhoto`, `AddPhotoRequest`, `ReorderPhotosRequest` (left `UserProfile.photoUrls` untouched — isolated contract). **Mobile:** added `react-native-image-picker@8.2.1` (**native module — Android needs a rebuild, not a Metro reload**); `features/profile/photos.ts` (pick → presign → raw `fetch` PUT to S3 → register, bypassing the axios `api`); new `PhotosScreen` (grid, add, tap → set-as-main/delete, 6 cap); `Photos` route in AppNavigator; ProfileScreen's "+"/Manage now route to `Photos`. Drag-reorder deferred (avoids a 2nd native lib); "set as main" covers it via the reorder endpoint. Backend typecheck + 7/7 tests green; mobile typecheck + 25/25 tests green; both lints clean. ✅ **S3 configured & verified end-to-end (2026-06-05).** `AWS_S3_BUCKET=g88-uploads-dev`, `AWS_REGION=eu-north-1`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` set on `g88-api`. Bucket `g88-uploads-dev` created in eu-north-1 with public-read bucket policy + CORS (PUT/GET); the `g88-uploads-dev-app` IAM user has an inline `s3:PutObject` policy on `arn:aws:s3:::g88-uploads-dev/*`. Live test passed: presign 200 → S3 PUT 200 → public GET 200 (bytes round-trip). Avatar upload now works in prod; the new `/users/me/photos` gallery endpoints share `S3Service` + the same bucket and will work identically **once deployed** (they live only on the local working tree so far — not yet committed/merged to `master`). 🔒 **Rotate:** the dev IAM access key (`AKIA2QGPX7…`) and the IAM console password were both pasted in chat.
- **2026-06-05** — **CI test jobs fixed + migration 0019 applied to prod.** **CI (PR #12):** Backend + Mobile checks had been red on every PR — `pnpm --filter X test -- --ci --runInBand` forwarded the `--` into the `jest` script, so jest read `--ci`/`--runInBand` as test-path patterns → "No tests found" → exit 1. Switched both jobs to `pnpm --filter X exec jest <flags>` (matching the workflow's lint steps). First fully-green CI on the repo: Backend + Mobile pass. **DB:** applied `0019_drop_apple_oauth.sql` to prod Supabase via MCP — dropped the `apple_sub` column + `users_apple_sub_idx` index and recorded the row in `schema_migrations`. Verified live: 0 `apple_sub` columns, migration row present. Prod DB now through `0019`. **Merge-recovery note:** the earlier "bottom-up" stack merge (#8→#9→#10) merged each PR into the branch below it instead of `master`, stranding #9/#10; recovered via PR #11 (`feat/remove-apple-signin` → `master`). All content confirmed on `master`.
- **2026-06-05** — **P4 deploy: G2 (Twilio) + G3 (Stripe) credentials landed** on `g88-api` (Render). Resolved a doc contradiction first: the live `schema_migrations` table shows **0001–0018 already applied** to prod Supabase, so the checklist's "run migrations 0012–0016" was stale — nothing to run. The real remaining work was env vars. **G2:** `TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID` set. **G3 (test mode):** `STRIPE_SECRET_KEY` (`sk_test_`), `STRIPE_WEBHOOK_SECRET`, and the existing test price IDs (`STRIPE_PRICE_BASIC`/`PREMIUM`) set; a fresh **test webhook** (`we_1TewGyQrMz3BrdsU1vKbM2JL`) was created via the Stripe API → `/api/v1/subscriptions/webhook` for the 4 events the handler processes. Vars set via the Render dashboard (the Render MCP was unreachable across the session; Stripe MCP doesn't expose webhook ops, so the webhook was created with curl + the test secret key). Saving on Render auto-redeploys `g88-api`. **G4 (social OAuth) deferred** — no provider creds. ⏳ **Not yet run-verified**: phone OTP SMS and checkout→webhook→`subscription_tier` flip still need a live exercise. Stripe stays **test mode** (no real charges) until explicitly taken live.
- **2026-06-05** — **Apple Sign-In (A3) removed from scope.** Reverses everything landed for A3 across the 2026-05-30/05-31 sprints. Backend: dropped `POST /auth/oauth/apple`, `AuthService.appleOAuth`, `AppleOAuthDto`, and the `apple-signin-auth` dependency. Mobile: dropped the `loginWithApple` thunk + its reducer cases, the "Continue with Apple" button, and the `@invertase/react-native-apple-authentication` dependency. iOS: deleted the `G88.entitlements` Apple-Sign-In capability (Podfile/.xcode.env kept — generic RN iOS scaffold). DB: migration `0019_drop_apple_oauth.sql` drops the `apple_sub` column + unique index (reverts `0009`; `IF EXISTS`-guarded, no data loss — Apple OAuth never went live). Both typechecks clean. **App Store caveat recorded** in the risk table: Apple mandates Sign in with Apple whenever any other social login ships, so an iOS build with Google-but-no-Apple is auto-rejected — must re-add Apple, drop Google on iOS, or go email-only on iOS before any iOS submission. Moot while Android-first. Next migration `0020`.
- **2026-06-04** — **Gifts (XP-funded, v1) shipped end-to-end** + Challenges mobile screen. Branch `feat/gifts-and-challenges`. **P1 (backend, `5d4da21`, migration 0018):** the design hinge is that XP was an append-only *score* (`total_xp`, drives level + leaderboard), so gifts can't spend it directly without corrupting rank. Resolved with a **dual-balance** model — added `spendable_xp` (earning funds it 1:1 in `awardRaw`; existing users' lifetime XP backfilled as opening balance), and `total_xp` stays untouched by spends. `gift_catalog` (6 seeded gifts) + `gifts` table; `POST /gifts/send` debits the wallet in a `FOR UPDATE` transaction (no double-spend), with catalog/balance/received reads. Recipient earns a fixed **`gift.received`** XP reward (10, **daily-capped at 5** via the existing ledger cap) — bounds XP minting from gift-trading. Fully curl-tested against a throwaway DB (atomic debit, insufficient-funds rollback, self-gift reject, sender score integrity, deduped recipient reward all verified); 0018 applied to prod. **P2 (mobile, `e4db003`):** `features/gifts/` hooks + `SendGiftSheet` (catalog grid with affordability gating + optional note), `GiftsInboxScreen` (wallet balance + received list), entry points on UserProfile ("Gift" button) and a Gifts balance card on ProfileScreen. **P3 (realtime/push, `86c6a37`):** `gift:received` server→client event; gateway emits live and falls back to FCM push only when the recipient has no socket (mirrors offline chat pushes); `notifyGift`; chat composer 🎁 affordance; push tap deep-links to GiftsInbox. **No refund/undo in v1 — a sent gift is final** (deliberate scope cut; revisit if abuse/mistake-send becomes a support burden). Both typechecks clean. ⚠️ Realtime+push path is code-verified, not run-verified (needs two socket clients + `FIREBASE_CREDENTIALS`, still unset). Next migration `0019`.
- **2026-06-02** — **Docs: corrected DB host.** Production Postgres runs on **Supabase** (`aws-0-eu-west-1.pooler.supabase.com`), not Render-managed Postgres as previously documented — both `.env` files and the migration runner target it, and it holds the live schema through `0017`. Render still hosts the **web services** (`g88-api`, `g88-realtime`) + Redis; those references are unchanged. Updated `CLAUDE.md`, `DEPLOY.md`, `STATUS.md`. (Note: `render.yaml` is referenced in repo-layout docs but no such file exists — left as-is pending a decision to add it or drop the reference.)
- **2026-06-01** — **Interest-based messaging gate.** Dot-tap card is now state-aware: Wave (stranger) · Message (match → full chat) · Message + "you both like…" (shared interest/goal → request). Kept the wave→match ladder (option A) and added a shared-interest **message request** path — one message until the recipient replies, then it promotes to full chat. New `MessagingService` (`messagePermission` = match ∨ interest∪goal overlap) owns the gate, consumed by both `UsersService` (viewer-relative `relationship` block on `GET /users/:id`) and `POST /conversations` (mints a pending request or returns the match convo; `chat.locked` otherwise). `chat.persist` enforces the one-message cap + recipient-reply promotion in a `FOR UPDATE` tx; a reciprocal wave promotes any prior pending request. Migration **0017_message_requests** adds `conversations.status` (`pending`/`accepted`, default accepted) + `initiated_by`. Shared: `MessagePermission`, `ProfileRelationship`, `ConversationStatus`, `CreateConversation{Request,Response}`; `ConversationSummary` gains `status`/`initiatedBy`. Mobile: `EntityBottomSheet` Message button + shared-interest hint; `ChatScreen` request banner + composer lock. Backend 16/16 (9 new MessagingService specs), mobile 25/25, both typechecks clean. **Trade** and **friend/follow** dot-actions remain deferred pillars. Next migration is `0018`.
- **2026-05-14** — Initial draft. R1 not yet started. Reconciliation verdicts locked.
- **2026-05-20** — R2 (P0 backend) + R3 (P0 mobile) complete.
- **2026-05-21** — R4 complete. All six P1 pillars done. A1 (opaque refresh tokens) + A2 (Google OAuth) shipped. Apple OAuth deferred to P2 (A3). Android CI, .gitignore, and Dependabot fixes also landed.
- **2026-05-22** — CI/tooling hardening. Migrated to pnpm 11 (workspace settings to `pnpm-workspace.yaml`). Bumped Node 22 (required by pnpm 11). Opted into Node.js 24 GitHub Actions runners ahead of June 2 deadline. Fixed `gradlew` execute bit (Android Build now green). Closed final Dependabot alert (uuid → 11.1.1, all 10/10 resolved).
- **2026-05-23** — Pulse v1 shipped (R5). Activity feed backend (`GET /feed`, `FeedService` aggregating chats + waves). Mobile: `PulseScreen` with filter chips, `pulseSlice`, `ActionHub` FAB. Tab bar is now Map · Pulse · Profile. Shared `ActivityItem`/`FeedResponse` types in `@g88/shared`. All tests green, both typechecks clean. Post-R5 fixes: `ProfileScreen` dispatches `fetchProfile` on focus (stale profile on return from edit); `ActionHub` filter routing via Redux `pendingFilter` channel (navigation timing race); `AppNavigator` auth gate + `restoreSession` wired. Migration script made idempotent via `schema_migrations` tracking table — `migration:run` now skips already-applied files safely.
- **2026-05-30** — P2 hardening sprint. **Deployed to Render**: `g88-api` live at `https://g88-api.onrender.com`; `g88-redis` (Frankfurt, free). Sentry project created (DE region), DSN wired in both apps and Render dashboard. Fixed `handleConnection` JWT guard gap (guards don't run on lifecycle hooks — token now verified directly in `handleConnection`). Added `GET /users/me` alias. **C6**: chat outbox retry queue — `outbox[]`/`failedIds[]` in chatSlice, drain on socket reconnect (up to 3 attempts), ⏱/retry UI in ChatScreen. **M1**: viewport-diff protocol — server stores snapshots in Redis (30s TTL), returns `diff:{added,removed}` on subsequent pans; client merges incrementally; `useDiscovery` is diff-unaware to callers. **A3** (partial): `POST /auth/oauth/apple` backend + `loginWithApple` mobile thunk + iOS entitlements scaffold; Xcode capability + Apple Developer Portal setup deferred to Mac. **Synthetic monitor**: `scripts/synthetic-monitor.mjs` + `.github/workflows/synthetic-monitor.yml` — cron `*/5 * * * *`, tests login→discovery→wave→chat, verified 4.6s on warm server, P1 DoD gate clock started.
- **2026-05-31** — P3 feature build-out begins. **Push**: FCM chat push wired + mobile setup, migrated to `@react-native-firebase` v22 modular API; firebase deps + CI `google-services.json` injection. **P3 #3**: geofence-triggered alert pushes — `NotificationsService.notifyGeofenceMatch` (gridDisk(3) pre-filter → exact ring test, skips author), fired fire-and-forget on `AlertsService.create`; mobile deep-links `type=alert` → Pulse/alerts. **P3 #1 gamification** (migrations 0010/0011): XP append-only ledger (idempotent via `(user_id, dedupe_key)`, daily-capped), levels (`50*(L-1)²`), daily streak; awards wired into match + alert-post. Slice 2 — daily challenges: 6-challenge catalog, 3/day seeded by date, per-user/day progress, bonus XP via ledger, `GET /challenges/today`, ProfileScreen card. **A3**: Apple Sign-In backend + mobile code complete (migration 0009); Xcode/Developer-Portal setup still pending. Both typechecks clean; migrations applied to prod DB. README + PRODUCT docs refreshed; mobile `API_HOST` now accepts a remote https host.
- **2026-05-31 (P4)** — Profile & monetization surface, G1–G5. **G1**: rich ProfileScreen rebuild + data foundation (migration 0012_profile_expansion: phone, date_of_birth, subscription_tier, interests on `users`; `user_photos` + `social_links`; UserProfile extended with photoUrls/age/subscriptionTier/socialLinks + server-derived verificationScore/badges). **G2**: Twilio Verify phone OTP (`/verification/phone/{start,check}`, ladder promotion, migration 0013 unique verified phone, dev-code fallback). **G3**: Stripe subscriptions — checkout + billing portal + signature-verified webhook reconciling `subscription_tier` (migration 0014; `main.ts` rawBody:true; tier authoritative only via webhook). **G4**: provider-generic social OAuth linking (6 providers, HMAC-signed-state server-side `/social/callback`, verified `social_links`; X/Twitter still needs PKCE). **G5**: Achievements + Leaderboard mobile screens over the pre-existing backend (commit 72bbfb2; `evaluate` wired into wave-match + alert-post). All env-gated and inert until creds land. Both typechecks clean; backend 7/7. Also fixed a pre-existing feed.service.spec mock gap. **Note**: migrations 0001–0015 made idempotent; the 0012 prefix collision was resolved by renaming the achievements migration to 0015_achievements (schema_migrations rows updated in lockstep). Next migration is 0019 (0016 drop-VIP, 0017 message-requests, 0018 gifts).
- **2026-05-24** — R6 (P2.5) installed + typecheck fix. `install-pulse-v2.py` landed all ContextualFab + Pulse v2 files. Post-install: fixed three typecheck errors — `useFabContext.ts` selectors corrected from non-existent `s.auth.user?.profile` to `s.profile.profile` (profile slice); `UserProfile` in `@g88/shared` extended with `goals?: string[]`; `@testing-library/react-native` added to mobile devDependencies; test mock stores updated to the real Redux state shape. Typecheck now clean (`tsc --noEmit` exits 0).


### Phase R6 — Pulse v2 + ContextualFab (P2.5) — ✅ COMPLETE 2026-05-29

P2.5 = parallel UX track. Does **not** displace the P2 sequence (A4 · OB1 · A3 · C6 · M1).

- [x] `apps/mobile/src/lib/analytics.ts` — single track() shim, swap to Sentry when OB1 lands
- [x] `apps/mobile/src/components/ContextualFab/` — context-aware speed dial
      replaces static `ActionHub` on `MapScreen`. Long-press OR double-tap → expand.
      Primary action adapts to `(zoomBand, density, visibility, goalsPrimary)`.
- [x] `apps/mobile/src/features/pulse/components/` — Nextdoor-style refactor:
      `ShareCTA` · `ActivityCard` · `NearbyPeopleStrip` · `TrendingStrip`
- [x] `apps/mobile/src/features/pulse/PulseScreen.tsx` — full visual replace
- [x] `apps/mobile/src/screens/AlertComposerScreen.tsx` — **stub** (X3 = real impl)
- [x] `AppNavigator.tsx` — register AlertComposer route, drop ActionHub render
- [x] **X3** — real AlertComposer (category picker, body, tag, POST /alerts).
      `POST_ALERT_READY = true` flipped. Alerts wired into GET /feed. Migration 0007_alerts.sql.
- [x] **X4** — backend `/trending/nearby?lat&lng` endpoint. `TrendingModule` + Redis 5-min cache.
      `useTrendingNearby` hook in mobile; `MOCK_TRENDING` removed from `PulseScreen`.
- [x] **X5** — `POST /geofences` + `GET /geofences/me/active`. Migration 0008_geofences.sql.
      `useActiveGeofences` hook in mobile (v1.5 FAB contract). Both typechecks clean.
- [x] **MapScreen patches** — applied by `install-pulse-v2.py` (3 edits: ContextualFab import, `useFabContext` hook, JSX mount replacing `ActionHub`).

Analytics events shipped (privacy-safe aggregates only):
`fab.context.computed` · `fab.tap.primary` · `fab.expand` · `fab.tap.secondary`
+ `fab.conversion` (host-emitted, e.g. wave success in MapScreen).

Acceptance:
- Single-tap on FAB executes primary action; long-press/double-tap expands.
- Pulse v2 renders ShareCTA + chips + Nearby + cards + Trending without crash.
- `fab.context.computed` fires exactly once per context-key flip.
- 5/5 ContextualFab unit tests pass; 3/3 PulseScreen smoke tests pass.
