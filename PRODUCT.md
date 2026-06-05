<!-- C:\Users\vganc\g88\PRODUCT.md -->

# G88 — Product

> **Authoritative source for what we are building and why.**
> Sibling docs: `ARCHITECTURE.md` (how), `ROADMAP.md` (when), `SPECIFICATION.md` (per-feature contracts), `STATUS.md` (live progress).
> Last revised: 2026-05-23 · Phase: P1 shipped, P2 active.

---

## One-liner

A map-first social app: see who and what is nearby, then act on it — wave, chat, meet, trade, attend.

## Why it exists

Existing apps each solve one slice and ignore the rest:

| App class            | What it shows                    | What it misses                                        |
|----------------------|----------------------------------|-------------------------------------------------------|
| Instagram / TikTok   | A feed of people you can't reach | Physical proximity, action                            |
| Tinder / Bumble      | Static swipe deck                | Live presence, group activity, anything beyond dating |
| Meetup / Eventbrite  | Events                           | People in between events                              |
| Nextdoor             | Neighborhood text wall           | Real-time presence, lightweight outreach              |
| Facebook Marketplace | Local listings                   | The social layer that closes the deal                 |

**G88 puts verified people and live events on a shared map and gives them lightweight, low-commitment ways to interact in the physical world.**

## Target users

- **Primary:** 18–34 urban, smartphone-native, socially curious, open to meeting nearby.
- **Secondary:** 35–50 looking for hyperlocal community, neighborhood events, casual trading.
- **Not optimized for:** users who want anonymous, content-only consumption (TikTok / Reddit lurkers).

## Launch market (Q4 answer: D)

| Stage | Geography                        | Trigger to advance                          |
|-------|----------------------------------|---------------------------------------------|
| α     | **Varna, BG** — single test city | 500 verified users · D7 ≥ 25%               |
| β     | Sofia                            | Varna unit economics validated              |
| 1.0   | Bulgaria                         | Combined α+β D30 ≥ 15% · crash-free ≥ 99.5% |
| 2.0   | EU                               | 1.0 retention sustained 3 mo                |

Single-city first lets us tune density, moderate edge cases manually, and avoid the cold-start problem that kills location apps at wide launch.

## Core jobs to be done

1. **See what's around me right now** — people, events, listings, all on one map.
2. **Reach out without commitment** — waves and gifts before deeper conversation.
3. **Decide who's real** — email · phone · photo · ID · social linking, all opt-in but visible as badges.
4. **Trade and transact locally** — listings + offers within walking/driving distance.
5. **Build reputation over time** — gamification (achievements, challenges, leaderboard) rewards positive repeat behavior.

## Product areas & detailed flows

### Core surfaces
- **Map/Discovery:** Viewport-driven nearby queries, clustering, and filters for people/events/listings.
- **Auth & Verification:** Email/phone + social logins; progressive identity verification (selfie, ID, social links).
- **Interactions:** Waves, gifts, lightweight offers, and 1:1 chat (Socket.IO + persistence).
- **Events & RSVP:** Create, discover, join, polls, and Q&A.
- **Marketplace:** Listings, offers, local trade flow, and basic Stripe integration.
- **Gamification & Reputation:** Achievements, challenges, and leaderboards.

### High-level user flows
- **Onboard:** Signup → profile creation → optional verification → location permission.
- **Discover:** Open map → viewport triggers `GET /discovery/nearby` → tap marker → open bottom sheet → wave/chat/listing/event actions.
- **Interact:** Send wave → backend persists Wave + emits socket event → recipient receives push + socket update → convert to chat.
- **Transact:** Create listing → buyer makes offer → accept → arrange local exchange; payments via Stripe for escrow or fees.

## Primary user flows

| Flow                                           | Module(s)                  | Status                        |
|------------------------------------------------|----------------------------|-------------------------------|
| Sign up + verify identity                      | `auth`, `verification`     | P1 ✓ (Apple SSO in P2)        |
| Build profile (photos, interests, goals)       | `profile` (multi-step)     | P1 ✓                          |
| Appear on map (visibility toggle, presence)    | `locations`, `map`         | P1 ✓                          |
| Discover nearby (filter by category, distance) | `discovery`, `map`         | P1 ✓                          |
| Wave at someone                                | `interactions`             | P1 ✓                          |
| 1:1 chat                                       | `chat` (Socket.IO + REST)  | P1 ✓ (outbox in P2)           |
| Create / join event with polls + Q&A           | `events`                   | Backend exists · UI polish P3 |
| Send a gift                                    | `gifts`                    | Backend exists · UI polish P3 |
| Post listing / make offer                      | `trading`, `market`        | Backend exists · UI polish P3 |
| Earn XP, level up, keep a daily streak         | `gamification`             | Backend exists · UI polish P3 |
| Complete daily challenges                      | `challenges`               | Backend exists · UI polish P3 |
| Earn achievement, climb leaderboard            | `gamification`             | Not built · full build P3     |
| Get notified when something happens nearby     | `notifications`, geofences | Backend exists · UI polish P3 |

## Feature scope by phase

### P1 — shipped (foundation)
Six pillars, all live: **Auth · Profile · Map Discovery · Presence · Wave · Chat.**

### P2 — pre-public-launch hardening (current)
Five items, in order:
1. **A4** — dev-secret cleanup
2. **OB1** — Sentry on both apps *(TestFlight blocker)*
3. ~~**A3** — Apple Sign-In~~ — **removed from scope 2026-06-05** (iOS social-login compliance to revisit before App Store; see `ROADMAP.md`)
4. **C6** — mobile chat outbox (offline send → retry)
5. **M1** — viewport-diff protocol (reduces map data over wire)

See `ROADMAP.md` for sequence + acceptance criteria.

### P3 — post-launch, habit-forming first (Q1 answer: D)

Ordered to prioritize daily-return triggers over revenue/utility:

1. **Gamification surfacing** — surface existing XP/levels/streaks/daily-challenges on profile/map; build + surface achievements and weekly leaderboard (no backend yet)
2. **Gifts (free virtual)** — earned via XP, sendable to other users; no money in v1
3. **Push notifications + geofences** — "someone waved", "event 200m away starting", daily digests
4. **Verification polish** — verification badges visible on map dots and profile cards
5. **Events UI polish** — event creation flow, RSVP, polls, Q&A surfaces
6. **Trending topics surfacing** — hyperlocal trending strip on map + discover
7. **Trading UI polish** — listing creation, offer flow, favorite/save

### P4+ — horizon (no work yet, Q2 answer: B)

Documented to anchor "not now" decisions:

- **Monetization** — subscriptions, marketplace fees, paid gifts (see below)
- **Live streaming** — WebRTC, location-anchored streams *(legacy roadmaps push this hard — we explicitly defer until post-launch metrics justify infra cost)*
- **Stories / ephemeral content**
- **Group chat** (1:1 only in v1)
- **Web client** (mobile-first only in v1)
- **Algorithmic discovery ranking** (beyond nearby + trending + filters)
- **International expansion beyond EU**

## Out of scope for v1 launch (explicit cuts)

- ❌ Monetization (Q3 answer: D — defer to post-launch)
- ❌ Web / desktop client
- ❌ Group chat
- ❌ Live video / streaming
- ❌ Multi-currency / international payments
- ❌ Algorithmic feed ranking beyond "nearby + trending"
- ❌ AR navigation / AR filters
- ❌ Crypto / NFT / blockchain anything
- ❌ Ads (now or ever as primary revenue — see monetization)

## Monetization (post-launch only, Q3 answer: C)

**v1 launch ships with zero payment flow.** This is deliberate: it removes a class of regulatory and trust risk during the critical retention validation window.

Post-launch monetization model (introduced one tier at a time, validated for impact on retention before stacking):

| Tier                | What it is                                                    | Infra status                                            | Earliest                              |
|---------------------|---------------------------------------------------------------|---------------------------------------------------------|---------------------------------------|
| 1 — Subscription    | Boost, super-likes, see-who-liked-you, advanced filters       | `subscriptionTier` field exists on `User`; Stripe wired | 60–90 days post-launch                |
| 2 — Marketplace fee | Stripe Connect Express on trade settlements; platform takes % | Stripe Connect wired in `payments` module               | After Tier 1 stable + 1k+ listings/wk |
| 3 — Paid gifts      | Virtual currency purchase; gifts become real-money revenue    | `gifts` module + `user-wallet` entity exist             | After Tier 2 stable                   |

**Never planned:** in-app advertising, selling user data, paywalling core safety features (blocking, reporting, verification).

## Entities (high level)

| Entity                                                            | Purpose                                                                                 |
|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `User`                                                            | Identity, profile, photos, interests, goals, location, verification, wallet, XP, scores |
| `Swipe` / `Match`                                                 | Discovery interactions                                                                  |
| `Conversation` / `Message`                                        | 1:1 chat (REST + WS `/chat`)                                                            |
| `Wave`                                                            | Lightweight outreach — the low-cost interaction                                         |
| `Event` / `Attendee` / `Poll` / `Question`                        | Geo-anchored event with engagement primitives                                           |
| `Gift` / `GiftCatalog` / `UserWallet` / `GiftTransaction`         | Virtual goods + economy                                                                 |
| `TradeListing` / `TradeOffer` / `TradeFavorite`                   | Local marketplace                                                                       |
| `xp_events` / `user_gamification` / `challenge_progress`          | Gamification — XP, levels, streaks, daily challenges (achievements + leaderboard not modeled yet) |
| `Geofence` / `Notification`                                       | Hyperlocal push triggers                                                                |
| `AdminUser` / `AuditLog`                                          | Moderation surface                                                                      |

Detailed schemas: `ARCHITECTURE.md` → "Database" + per-module entity files.

## Tech foundations (one-line reference)

Full detail in `ARCHITECTURE.md`. Summary so this doc is self-contained:

- **Mobile:** RN 0.83, React 19, TS 5.8, RTK 2, RN Nav 7
- **Backend:** NestJS 11, TypeORM, PostgreSQL + PostGIS, Redis, Socket.IO 4
- **Geo:** PostGIS `geography(Point, 4326)` + Redis GEO + H3
- **Auth:** Opaque rotating refresh tokens (DB) + Google OAuth; Apple SSO P2
- **Storage:** AWS S3 (presigned URLs)
- **Comms:** Twilio (SMS), SendGrid (email), Firebase (push)
- **Payments:** Stripe + Connect Express (wired, not user-flow integrated in v1)
- **Identity verify:** AWS Rekognition (face compare), ID doc upload

## Privacy & safety posture (hard constraint)

Location is sensitive. Treated as a first-class privacy concern, not a feature flag:

- **Default visibility = opt-in.** New users are invisible on map until they explicitly publish.
- **Visibility toggle** is one tap from any surface.
- **Approximate location** (~100m jitter) on the public map; exact only for distance calculation, never exposed.
- **Block + report** available everywhere a profile or message renders.
- **GDPR-compliant deletion** via `DELETE /users/me` — wipes user + cascades.
- **No location history retention** beyond 30 days for routing/analytics; aggregate only afterwards.
- **Privacy zones (home/work geofence suppression)** — P3 enhancement.

## Success metrics

Keep small. The minimal set v1 launch is judged by:

| Metric                        | Target by end of α (Varna) | Why                     |
|-------------------------------|----------------------------|-------------------------|
| D1 retention                  | ≥ 40%                      | Onboarding works        |
| D7 retention                  | ≥ 25%                      | Core loop sticks        |
| D30 retention                 | ≥ 15%                      | Habit forms             |
| % verified users (any tier)   | ≥ 60%                      | Map is real, not bots   |
| Wave → chat conversion        | ≥ 20%                      | Low-cost outreach works |
| Events with ≥ 3 attendees     | ≥ 30% of created events    | Supply-side health      |
| Listings with ≥ 1 offer (P3)  | ≥ 25% of listings          | Marketplace liquidity   |
| Crash-free sessions           | ≥ 99.5%                    | OB1 (Sentry) measurable |
| Median P50 map load           | < 1.0s                     | Performance target met  |
| Battery drain per active hour | < 5%                       | Performance target met  |

**Not tracked as success metrics in v1:** MAU bragging numbers, time-in-app, ad impressions (none of these align with the product's actual value).

## Anti-patterns (things this product will not become)

- **A feed.** The map is the home surface. We do not optimize for endless scroll.
- **A dating app first.** Dating is one of several JTBDs. Positioning it as "Tinder with a map" would cap the addressable market and exclude the trading/events users.
- **An ad network.** See monetization.
- **A growth-hacked notification spammer.** Push is opt-in by channel, with frequency caps.

## Decision log (key choices behind this doc)

| Date       | Decision                                                           | Source         |
|------------|--------------------------------------------------------------------|----------------|
| 2026-05-23 | Launch market: Varna single-city → Sofia → BG → EU                 | Q4 → D         |
| 2026-05-23 | P3 priority order: gamification + gifts before marketplace         | Q1 → D         |
| 2026-05-23 | No monetization in v1; post-launch tiers (sub → fees → paid gifts) | Q3 → D, then C |
| 2026-05-23 | Live streaming = P4+ horizon, no work                              | Q2 → B         |
| 2026-05-23 | Three split docs: PRODUCT / ROADMAP / SPECIFICATION                | Q5 → A         |
