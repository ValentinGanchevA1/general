# G88 — Roadmap

> **Authoritative source for sequence and timing.**
> Sibling docs: `PRODUCT.md` (what/why), `SPECIFICATION.md` (contracts), `ARCHITECTURE.md` (how), `STATUS.md` (live progress).
> Last revised: **2026-09-14**.

---

## Status snapshot

| Phase | Status | Gate |
|-------|--------|------|
| P1 — foundation | ✅ shipped | Auth · Profile · Map Discovery · Presence · Wave · Chat |
| P2 — pre-launch hardening | ✅ shipped | Engineering complete; remaining = owner Play Console |
| P3 — habit-forming features | ✅ shipped | P3.1–P3.7 + friends + interactions inbox |
| P4+ — horizon | 🟡 partial | **P4.S Stories shipped**; monetization / group chat / web still gated |

**Post-P3 hardening on master (2026-08 → 2026-09):** friends graph, stories, profile origin/cover, ID admin queue, offers/counter, map polish (Search · CategoryFilterBar · TrendingCard), EntityBottomSheet v2, listing mode, friends-only layer, online privacy, UX primitives (ScreenHeader, FormField, ListRow, EmptyState).

Migrations **0001–0040**; next free **0041**. Target launch market: **Varna, BG** (see `PRODUCT.md`).

## How to read this doc

- **P2/P3 engineering gates are closed.** Owner-side Play / App Store steps remain in `STATUS.md` / `DEPLOY.md`.
- **Live truth** is always `STATUS.md`. This file is sequence + cuts + risk.
- **P4+ is intentionally vague** except items explicitly marked shipped (P4.S).

## Phase legend

```
🟢 done    🟡 in flight    ⏳ next    📋 horizon    ❌ explicitly cut
```

## P1 — Foundation ✅

Auth · Profile · Map discovery · Presence · Wave · Chat. See `SPECIFICATION.md` §2.1–§2.6.

## P2 — Pre-launch hardening ✅

All engineering items closed:

| ID | Item | Status |
|----|------|--------|
| A4 | Dev-secret cleanup | ✅ |
| OB1 | Sentry + PII scrubber | ✅ |
| A3 | Apple Sign-In | ❌ reset (0019 drop); rebuild when iOS is in scope |
| C6 | Mobile chat outbox | ✅ |
| M1 | Viewport-diff discovery | ✅ |
| B1 | Blocks (incl. wave.blocked) | ✅ |
| C2 | Per-module backend specs | ✅ |
| Soak | 7-day synthetic | ✅ |

Remaining: owner Play Console closed testing (`STATUS.md`).

## P3 — Habit-forming ✅

| Epic | Status |
|------|--------|
| P3.1 Gamification | ✅ |
| P3.2 Gifts | ✅ |
| P3.3 Push + geofences | ✅ |
| P3.4 Verification visibility | ✅ |
| P3.5 Events | ✅ |
| P3.6 Trending | ✅ (map topic filter + client TrendingCard) |
| P3.7 Trading | ✅ offers + counter + listingMode — see SPEC §2.14 |
| Friends graph | ✅ SPEC §2.12 |
| Interactions inbox | ✅ |

## P4+ — Horizon

| ID | Item | Status |
|----|------|--------|
| P4.S | Stories / ephemeral | ✅ shipped (Pulse; soft gate email+age) |
| P4.M | Monetization / Connect | 📋 gated on retention |
| P4.G | Group chat | 📋 |
| P4.W | Web / desktop client | 📋 |
| P4.L | Live streaming | ❌ deferred (infra + moderation) |
| P4.I | Geo expansion beyond EU | 📋 |

## Explicit cuts

Microservices-from-day-one · Kafka · GraphQL · Elasticsearch · Kubernetes · anonymous-only social · global cold-start feed as primary surface.

## Risk register (active)

| ID | Risk | Mitigation |
|----|------|------------|
| R-Play | Play Console delay | Sideload APK channel live; engineering path complete |
| R-Rekognition | Assist scores off in prod | Human decide still works; enable env when ready |
| R-Abuse | Friend-request spam | Limits after first abuse signal; blocks + strikes schema |

## Changelog

- **2026-09-14** — Status snapshot: P2/P3 closed; P4.S shipped; post-P3 friends/map/sheet/offers wave documented. Migrations 0001–0040 / next 0041.
- **2026-09-12** — P2.B1 remaining-scope cleared (wave.blocked verified).
- **2026-08–09** — Friends, Stories, profile origin, ID admin, offers schema ahead of original P4 placement (STATUS.md).
