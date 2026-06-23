<!-- C:\Users\vganc\g88\ROADMAP.md -->

# G88 — Roadmap

> **Authoritative source for sequence and timing.**
> Sibling docs: `PRODUCT.md` (what/why), `SPECIFICATION.md` (per-feature contracts), `ARCHITECTURE.md` (how), `STATUS.md` (live progress).
> Last revised: 2026-05-23.

---

## Status snapshot

| Phase                       | Status             | Gate                                                    |
|-----------------------------|--------------------|---------------------------------------------------------|
| P1 — foundation             | ✅ shipped          | Auth · Profile · Map Discovery · Presence · Wave · Chat |
| P2 — pre-launch hardening   | ✅ gate complete    | A4 · OB1 · C6 · M1 · C2 done; 7-day soak cleared (2026-06-11). Beta = **Android Play closed testing** (iOS/TestFlight deferred — no `ios/` native project) |
| P3 — habit-forming features | 🟢 surfaced early   | **P3.1–P3.7 all shipped in mobile** (2026-06-15); backend built ahead of schedule. See per-epic sections below |
| P4+ — horizon               | 📋 documented only | P3 retention sustained                                  |

Target launch market: **Varna, BG** (single test city — see `PRODUCT.md` § Launch market).
Immediate gate: **owner-side Android Play Console closed-testing setup**. As of **2026-06-23 the engineering prep is complete** — keystore + CI secrets set, **signed AAB built + verified**, automated Play upload wired, store-listing/Data-Safety/release-notes drafted (`docs/`), **privacy policy hosted + filled** (`https://g88-legal.onrender.com/privacy`), and **in-app account deletion shipped** (`DELETE /users/me`). Remaining is **Console-only**: $25 registration, create app `com.g88` + closed track, opt into Play App Signing + add its SHA-1 to the Maps key, **manual first AAB upload**, paste listing/Data-Safety/privacy URL. See `DEPLOY.md` → "Mobile release". `STATUS.md` is the live truth.

> **Phase vocabulary is authoritative here.** These four phases (P1 · P2 · P3 · P4+) are the canonical sequence. **There is no P5.** `STATUS.md` historically used `P3`/`P4`/`P5` as ad-hoc *sprint* labels for feature build-out — see the "Phase-vocabulary reconciliation" table at the top of `STATUS.md` for the mapping back to these phases.
>
> **Heads-up (this table predates current reality, last revised 2026-05-23):** since then, substantial **P3 (habit-forming)** backend — gamification, challenges, achievements, gifts, geofence push — and parts of the **P4+** monetization surface (Stripe subscriptions, Twilio, ID-verification) have been **built ahead of schedule**. So "P3 — post-launch / work hasn't started" below is stale: the backend largely exists; the remaining P3 work is **mobile surfacing**, not greenfield. `STATUS.md` is the live truth for what's actually built.

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

Five items, ordered. Each must close cleanly before the next starts.

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

|                |                                                                                                                                                                                                             |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Crash visibility is non-negotiable for public TestFlight. C3 (no observability) is a Critical-severity debt item.                                                                                           |
| **Scope**      | `@sentry/react-native` in mobile · `@sentry/nestjs` in backend · DSN per env · source-map upload in mobile release script · PII scrubbing (no email/phone/location in breadcrumbs) · alert routing to Slack |
| **Acceptance** | A deliberate test crash from mobile appears in Sentry within 60s with symbolicated stack · backend unhandled exception appears with request context (no PII) · alert fires                                  |
| **Risk**       | Sentry quota burn from noisy errors → set traceSampleRate to 0.1 in prod, 1.0 in dev · PII leak via breadcrumb auto-capture → manual `beforeSend` scrubber                                                  |
| **Effort**     | 1.5 days                                                                                                                                                                                                    |
| **Blocks**     | TestFlight release                                                                                                                                                                                          |

### ~~P2.A3 — Apple Sign-In~~ (removed from scope 2026-06-05)

**Removed.** Apple Sign-In was code-complete but never had working credentials; deleted on 2026-06-05 (code, deps, iOS entitlement, `apple_sub` column via migration `0019`). See `SPECIFICATION.md` §3.3 and the `STATUS.md` change log.

**Still open for any iOS submission:** Apple Guideline 4.8 mandates Sign in with Apple when a third-party social login is offered. Google is live, so an iOS build must re-add Apple, drop Google on iOS, or go email-only on iOS. Android-first → deferred, not blocking now.

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

|                |                                                                                                                                                                                                                                                  |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Why**        | Mobile pulls full nearby-user payload on every viewport change. Wasteful on data + battery.                                                                                                                                                      |
| **Scope**      | Backend `GET /locations/map-data` accepts `?since=ts&previousIds=…` · returns `{ added: [], updated: [], removed: [] }` · mobile `mapSlice` applies diffs · WS `nearby:update` already does this for individual users — extend to viewport-level |
| **Acceptance** | Median bytes/viewport-change drops ≥ 60% in dev measurement · no visible regression in map render · works correctly across viewport pan vs zoom                                                                                                  |
| **Risk**       | Stale client state if a diff is dropped → fall back to full fetch on any missing-id signal                                                                                                                                                       |
| **Effort**     | 2 days                                                                                                                                                                                                                                           |
| **Spec**       | See `SPECIFICATION.md` § Map / M1                                                                                                                                                                                                                |

### P2 total

Roughly 7.5 dev-days, plus QA + TestFlight review. **Estimated wall-clock: 3 weeks** assuming no rework.

---

## TestFlight gate

Cannot submit to TestFlight until **all** are true:

- ✅ A4 closed (no committed secrets)
- ✅ OB1 closed (Sentry receiving events)
- ⚠️ A3 removed (no Apple Sign-In). **iOS social-login compliance unresolved** — re-add Apple, drop Google on iOS, or ship email-only on iOS before any App Store submission (Guideline 4.8)
- ✅ Crash-free rate ≥ 99% on internal dogfood for 7 consecutive days
- ✅ At least one `.spec.ts` exists per backend module (closes worst of C2 debt) — minimum bar, not full coverage
- ✅ Privacy nutrition labels filled in App Store Connect

## App Store gate (on top of TestFlight gate)

- ✅ C6 closed (chat outbox shipping)
- ✅ Privacy policy + terms of service URLs live and reachable
- ✅ Demo account credentials provided to App Review
- ✅ Age rating questionnaire completed (anticipated: 17+ due to dating + user-to-user content)
- ✅ Screenshots + preview video on App Store Connect
- ✅ EU DSA compliance text (point of contact, terms) on site

---

## P3 — Habit-forming features (post-launch)

Ordering rationale: **daily-return triggers before utility before revenue.** Per Q1 → D.

Each epic gets a full spec in `SPECIFICATION.md` at the start of its sprint.

### P3.1 — Gamification surfacing
- Backend exists for **XP, levels, daily streaks** (`gamification` module) and **daily challenges** (`challenges` module).
- ~~**Achievements and leaderboard have no backend**~~ — **stale, corrected 2026-06-11.** Both shipped in the G5 sprint (2026-05-31): `achievements` module + `user_achievements` table (migration `0015_achievements`) + `GET /achievements`; leaderboard via `GET /gamification/leaderboard` (weekly + all_time) with supporting indexes in the same migration. Shared contracts in `@g88/shared/{achievements,gamification}`. `STATUS.md` is authoritative.
- Mobile screens exist (Achievements + Leaderboard) but most surfacing is **done**: ProfileScreen already shows the XP/level `ProgressCard` and today's challenges. As of 2026-06-11 the **daily-challenge card on map open**, the **earned toast/haptic** (new `achievement:unlocked` realtime event), and the **weekly-reset ribbon** on the leaderboard (countdown + caller's standing, server-computed `resetsAt`) all shipped.
- ~~Remaining work: optional "complete your verification" / streak nudges.~~ **Shipped — P3.1 complete (2026-06-14).** Both nudges live in `features/nudges/useNudges.ts` + `NudgeBanner`, mounted on `MapScreen`: (1) **verification nudge** — `none` accounts past the D2 age gate (or any `rejected` ID) → "Get ID-verified" / "Resubmit"; (2) **streak nudge** — reworked from a daily "keep it going today" reminder (redundant: the foreground `ping` already secures the streak before the Map renders, so it nagged every day) to a **milestone celebration** firing only on 3/7/14/30/60/100/180/365-day days, which surfaces ~once per milestone naturally. Verification outranks the streak; dismissals persist with a per-nudge cooldown. Eligibility extracted to a pure `selectNudge()` with a 15-case spec. No net-new backend.
- Effort: **done.** (was ~5d surfacing + ~3–4d backend — all built; backend pre-existed.)

### P3.2 — Gifts (free virtual, XP-funded)
- Backend exists (`gifts`, `user-wallet`, `gift-transaction`).
- Wallet seeded by XP earned through gamification — **no money changes hands in v1**.
- Work: gift catalog UI · send flow from profile/chat · receive notification · wallet balance display.
- Effort: ~4 days.
- Pairs with P3.1 — gamification has no payoff without gifts to spend XP on.

### P3.3 — Push notifications + geofences
- Backend exists (`notifications`, `geofence.service` with scheduled sweeps).
- Work: FCM device-token registration · per-channel opt-in (waves · matches · nearby events · listings · daily digest) · backend sweep dispatches geofenced notifs · frequency cap per channel.
- Effort: ~4 days.

### P3.4 — Verification visibility polish
- Backend complete (phone OTP, photo + ID via **manual review** — Rekognition face-compare stays deferred, not in code; the original "via Rekognition" line was stale).
- ~~Work: visible verification badges on map dots, profile cards, chat headers · "complete your verification" nudge for unverified accounts after D2 · trust-score indicator.~~ **Shipped 2026-06-13.**
- **Shipped:** shared `VerificationBadge` (two-tier: ID-verified decagram vs. partial ✓) now used on **map dots** (already had it), the **map bottom-sheet**, **other-user profile cards** (`UserProfileScreen`), and **chat headers** (`ChatScreen` gained a header row carrying the badge). Other-user cards now show a **trust-score bar** (0–100 ladder) + earned ladder badge chips — `PublicUserProfile` gained `verificationScore` + `idVerified`. The **"complete your verification" nudge** (`useNudges`) is now **gated on account age ≥ 2 days** (post-D2) for fresh `none` accounts; a `rejected` ID bypasses the hold. `UserProfile` gained `createdAt` to drive the gate.
- **Deferred:** conversation-list participant badges (no Inbox screen consumes `ConversationSummary` yet — chat badge rides nav params from the map entry point instead); social/premium badges on *other-user* cards (kept the public query cheap — ladder + ID only); a true multi-tier composite trust score (the ladder score + badge chips cover v1).
- Effort: ~1.5 days (was ~3d est; most surfacing already existed).

### P3.5 — Events
- ~~Backend complete (events + attendees + polls + questions, WS `/events` gateway).~~ **Stale, corrected 2026-06-12.** Only a bare `events` table existed in `0001`; there was no events module, no attendees/polls/questions tables, and no `/events` gateway — and `STATUS.md` had `events` marked DEFER. The original "UI polish" framing was wrong.
- **Backend built 2026-06-12** (greenfield, not polish): migration `0022_events.sql` (`event_attendees`, `event_polls`/`options`/`votes`, `event_questions`/`upvotes`) + `events` module under `/events`. REST surfaces: create · `POST /events/nearby` ("events near you") · `GET /events/:id` detail · `PUT /events/:id/rsvp` (capacity-gated) · poll create/list/vote · question ask/list/upvote. RSVP + Q&A are REST-polled in v1; live fan-out over `/realtime` is a follow-up.
- **Mobile shipped 2026-06-12** — `features/events/` data layer + `EventDetailScreen` (RSVP + attendee list + live polls with inline host composer + Q&A with upvotes) + `EventCreateScreen` (dependency-free day/time/duration chips, draggable map-pin venue, capacity, visibility) + "events near you" map rail (leads with a New-event card for cold-start density). Navigation registered (`EventDetail` + `EventCreate` modal).
- **P3.5 core complete.** ~~Deferred follow-ups: live `/realtime` poll/Q&A deltas (REST-polled today)~~ **— shipped 2026-06-15.** `EventDetailScreen` now updates poll tallies, new questions, and upvotes live for every viewer in the event room (`event:{id}`), no refetch. Socket contract: `event:join`/`event:leave` (ack'd) + `event:poll`/`event:question`/`event:question:upvote` (S→C) in `@g88/shared/events`. Payloads are **viewer-agnostic** (no `myVote`/`upvotedByMe` — those are per-viewer); each client merges shared counts on top via pure `eventMerge` reducers, preserving its own vote state. Gateway gates `event:join` with the same private-event visibility check as the REST detail read. Remaining deferred: polls during the creation flow (host adds them on the detail screen instead); FAB/rail overlap polish.

### P3.6 — Trending topics surfacing
- Backend exists (trending service with geohash-bucketed Redis sorted sets, 24h TTL).
- Work: trending strip on map header · trending screen showing top topics per area · "join the conversation" → group chat (requires group chat — defer to P4) or filter map by topic (v1).
- Effort: ~3 days.

### P3.7 — Trading
- ~~Backend complete (`trade-listing`, `trade-offer`, `trade-favorite`).~~ **Stale, corrected 2026-06-12.** Only a bare `listings` table existed in `0001`; there was no trading module and no offers/favorites tables — and `STATUS.md` had `trading/*` marked deferred. The "UI polish" framing was wrong.
- **Backend built 2026-06-12** (greenfield, not polish): migration `0024_trading.sql` (`trade_offers`, `trade_favorites`) + `listings` module under `/listings`. REST: create · `POST /browse` (grid) · `GET /:id` detail · `PUT /:id/status` (mark sold/withdrawn) · `PUT /:id/favorite` (toggle) · `POST /:id/offers` + `GET /:id/offers` + `PUT /:id/offer/withdraw` · `PUT /offers/:offerId` (seller accept/decline → accepting marks the listing sold + declines the rest). **Offer-based v1 — no payment processing** (Stripe Connect stays P4).
- **Mobile shipped 2026-06-12** — `features/trading/` data layer + `MarketplaceScreen` (nearby browse grid + saved tab + sell entry) + `ListingDetailScreen` (favorite · buyer offer flow · seller offer management with accept/decline · wave the seller) + `ListingCreateScreen` (price/currency/category + draggable map-pin). Entry points: `create_listing` FAB → Marketplace; listing map markers → detail. Navigation registered (`Marketplace`, `ListingDetail`, `ListingCreate` modal).
- **P3.7 core complete.** ~~Deferred: listing photo upload (thumbnail-by-URL only in v1)~~ **— shipped 2026-06-15.** Sellers can now attach a real photo: `ListingCreateScreen` has an image picker that uploads via `POST /listings/photo/base64` (base64-over-JSON, the same RN-safe path as the profile gallery — avoids the multipart "Stream Closed" bug) → returns the public S3 URL → passed as `thumbnailUrl` on create. Backend reuses the S3 buffer-upload under a `listings/` key prefix; 10 MB cap; image MIME allow-list. Remaining deferred: real-money checkout (Stripe Connect, P4).
- **Still no payment in v1.** Trades coordinated through chat / offers, settled offline. Revisit at monetization Tier 2 (Stripe Connect).

### P3 total

~32 dev-days. **Estimated wall-clock: 8–10 weeks.** Will likely re-prioritize mid-flight based on Varna telemetry.

---

## P4+ — Horizon (documented, not committed)

Anchored here to give clear "not now" answers. Each is fully out of scope until P3 retention metrics validate further investment.

### P4.M — Monetization (per Q3 → C, staged)

| Tier                 | What                                                | Trigger to start                                  |
|----------------------|-----------------------------------------------------|---------------------------------------------------|
| M1 — Subscription    | Boost, super-likes, see-who-liked, advanced filters | D30 retention ≥ 15% sustained 60 days post-launch |
| M2 — Marketplace fee | Stripe Connect on settled trades, platform %        | M1 stable + 1k+ listings/week in launch market    |
| M3 — Paid gifts      | Real-money gift purchase tops up wallet             | M2 stable + gift send rate ≥ 0.5/DAU              |

### P4.L — Live streaming (per Q2 → B)
WebRTC, location-anchored streams. **Explicitly deferred.** Legacy roadmaps push this as a P2 feature; we don't have the infra budget or content-moderation pipeline to ship it safely pre-launch. Revisit at month 12 post-launch.

### P4.G — Group chat
1:1 only in v1. Group chat unlocks event chat, neighborhood threads, and trade negotiation rooms. Likely first P4 feature after monetization.

### P4.S — Stories / ephemeral content
24h location-tagged stories. Hooks into discovery and gives passive users a creation surface.

### P4.W — Web / desktop client
Mobile-first is a feature, not a constraint, until users ask for it. Web client likely as `app.g88.app` admin surface first, consumer web after.

### P4.I — Geographic expansion beyond EU
Bulgaria → EU first. Beyond EU triggers regulatory complexity (different payment rails, content laws, GDPR-equivalents) that we'll treat as a separate planning effort.

---

## Risk register

| ID     | Phase | Risk                                                               | Likelihood               | Impact                             | Mitigation                                                                                                              |
|--------|-------|--------------------------------------------------------------------|--------------------------|------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| R-P2-1 | P2    | App Store rejects on first submission (common)                     | High                     | 2-week delay                       | Pre-validate against current guidelines · keep demo account fresh · have rejection-response template ready              |
| R-P2-2 | P2    | Apple SSO email-relay edge cases corrupt account merge             | Medium                   | Account-merge bugs in early users  | Treat Apple `sub` (not email) as identity primary · test relay path explicitly                                          |
| R-P2-3 | P2    | Sentry quota blown by noisy first launch                           | Medium                   | Lost crashes from quota throttling | Conservative sample rate · alert on quota at 70% · scrubber tested                                                      |
| R-P3-1 | P3    | Cold-start density in Varna too low for map to feel alive          | High                     | Retention dies                     | Manual seeding via partner outreach · trending fakeout (highlight any activity) · invite-friends nudge in onboarding    |
| R-P3-2 | P3    | Notification overload kills opt-in rate                            | Medium                   | Channel becomes unusable           | Per-channel granular opt-in · frequency caps · digest-mode option from launch                                           |
| R-P3-3 | P3    | Gamification → empty achievements → users feel hollow loop         | Medium                   | Engagement drops post-novelty      | Ship gifts alongside (P3.1 + P3.2 paired) so XP has a payoff                                                            |
| R-P4-1 | P4    | Live streaming legal exposure (impersonation, CSAM, broadcast law) | High                     | Existential                        | Don't ship without moderation pipeline · keep deferred until staffed                                                    |
| R-H1   | All   | RN 0.83 + React 19 native lib compatibility (per tech debt H1)     | Ongoing                  | Build break on dep update          | Lock RN/React majors · vet every new native dep before merge · keep Expo modules off the table                          |
| R-C2   | All   | Zero-test backend means regressions ship invisibly                 | Critical (existing debt) | Bug whack-a-mole                   | TestFlight gate requires ≥1 `.spec.ts` per module · expand coverage in P3 · do not delete this row until coverage ≥ 60% |

---

## Cuts list — explicit non-roadmap

Listed here so they don't keep resurfacing in planning conversations. Source: 13 legacy roadmap files audited 2026-05-23.

| Cut                                          | Why                                                                                                                |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| K8s / Kubernetes                             | Render.com is sufficient for ≤ 100k DAU. K8s adds ops cost with no product benefit at this scale.                  |
| Kafka / RabbitMQ event bus                   | NestJS events + Redis pub/sub cover current needs. Add when we have cross-service async fan-out that justifies it. |
| GraphQL / GraphQL Federation                 | REST + WS is shipping. GraphQL would be a stack rewrite mid-flight.                                                |
| gRPC inter-service                           | Single backend service. Not applicable.                                                                            |
| Elasticsearch                                | Postgres FTS + Redis sorted sets handle current search/trending. Revisit at 1M+ listings.                          |
| InfluxDB                                     | No time-series workload exists. Aggregations live in Postgres.                                                     |
| Prometheus / Grafana / ELK / Jaeger          | Sentry + Render logs are the v1 observability surface. Self-hosted stack premature.                                |
| Terraform / IaC                              | Render dashboard config is fine pre-multi-region.                                                                  |
| Microservices split                          | We have one backend. Splitting prematurely costs more than it saves. Revisit when team > 5 engineers.              |
| AR / VR                                      | No product need. Battery + hardware support not there.                                                             |
| Blockchain / NFT / crypto payments           | No product need. Adds regulatory + UX complexity.                                                                  |
| AI-powered matching (transformer-scale)      | Geographic proximity + interest overlap is the v1 ranking. ML matching is a P4 question after we have retention.   |
| Web / desktop client (v1)                    | Mobile-first by design.                                                                                            |
| Group chat (v1)                              | 1:1 only.                                                                                                          |
| Live streaming (v1, v2, v3)                  | P4+ horizon — see R-P4-1.                                                                                          |
| Multi-currency / international payments (v1) | EUR + BGN only at launch.                                                                                          |

---

## Versioning of this doc

- Update on every phase transition (P2 → P3 → P4).
- Update mid-phase when scope materially changes (item added/dropped/reordered).
- Don't update for day-to-day progress — that lives in `STATUS.md`.

## Decision log

| Date       | Decision                                                        | Rationale                                                            |
|------------|-----------------------------------------------------------------|----------------------------------------------------------------------|
| 2026-05-23 | P3 ordering: gamification + gifts first                         | Q1 → D · habit-forming triggers ahead of utility/revenue             |
| 2026-05-23 | Live streaming → P4+ horizon                                    | Q2 → B · infra + moderation cost too high pre-launch                 |
| 2026-05-23 | Zero monetization in v1                                         | Q3 → D · removes regulatory + trust risk during retention validation |
| 2026-05-23 | Post-launch monetization tiers in order: sub → fee → paid gifts | Q3 → C · validate each before stacking next                          |
| 2026-05-23 | Single-city launch (Varna) → Sofia → BG → EU                    | Q4 → D · avoid cold-start density failure                            |
