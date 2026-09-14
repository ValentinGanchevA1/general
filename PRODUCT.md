# G88 — Product

> **Authoritative source for what we are building and why.**  
> Sibling docs: `ARCHITECTURE.md` (how), `ROADMAP.md` (when), `SPECIFICATION.md` (contracts), `STATUS.md` (live progress).  
> Last revised: **2026-09-14**.

---

## One-liner

A map-first social app: see who and what is nearby, then act on it — wave, chat, meet, trade, attend.

## Why it exists

| App class | What it shows | What it misses |
|-----------|---------------|----------------|
| Instagram / TikTok | Feed of people you can't reach | Physical proximity, action |
| Tinder / Bumble | Static swipe deck | Live presence, group activity beyond dating |
| Meetup / Eventbrite | Events | People between events |
| Nextdoor | Neighborhood text wall | Real-time presence, lightweight outreach |
| Facebook Marketplace | Local listings | Social layer that closes the deal |

**G88 puts verified people and live activity on a shared map and gives low-commitment ways to interact in the physical world.**

## Target users

- **Primary:** 18–34 urban, smartphone-native, socially curious, open to meeting nearby.
- **Secondary:** 35–50 looking for hyperlocal community, events, casual trading.
- **Not optimized for:** pure content lurkers with no intent to act offline.

## Launch market

| Stage | Geography | Trigger to advance |
|-------|-----------|--------------------|
| α | **Varna, BG** — single test city | 500 verified users · D7 ≥ 25% |
| β | Sofia | Varna unit economics validated |
| γ | Other BG / select EU cities | β retention + abuse tools stable |

## Product pillars (shipped vs horizon)

| Pillar | Status |
|--------|--------|
| Map discovery + presence | ✅ Shipped (H3, clustering, viewport diff, filters) |
| Auth + progressive verification | ✅ Email · phone · ID (human review + assist Rekognition) |
| Wave + 1:1 chat | ✅ Shipped (+ live location share sessions) |
| Friends graph | ✅ Requests, mutual, suggestions, online privacy |
| Events | ✅ Create · discover · RSVP · polls/Q&A |
| Marketplace | ✅ Listings · offers · counter · Wanted mode |
| Gifts + gamification | ✅ XP, challenges, achievements, leaderboard |
| Stories | ✅ P4.S on Pulse (soft gate: email + account age) |
| Interactions inbox | ✅ Waves + friend requests + recent followers |
| Group chat / live streaming / paid gifts | 📋 Horizon — explicit go-ahead required |
| Monetization (premium, Connect) | 📋 Horizon — gated on retention |

## Non-goals (explicit)

- Anonymous-only social (verification ladder is core).
- Global cold-start feed (map + viewport is the primary surface).
- Microservices / Kafka / GraphQL before load justifies them.
- iOS App Store before Android closed testing proves the loop.

## Success metrics (α)

- D1 / D7 retention on verified users.
- Waves → chat conversion.
- Listings with ≥1 offer within 48h.
- Zero tolerance for unblocked harassment paths (blocks + strikes).

See `STATUS.md` for engineering truth and ops gaps.
