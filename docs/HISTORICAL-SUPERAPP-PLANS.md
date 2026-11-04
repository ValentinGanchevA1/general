# Historical super-app plans (superseded)

> **Status:** Historical only. Do not use as product or engineering guidance.
> **Superseded:** 2026-09-26 product reality check and subsequent NEXA focus.

## Source files (attachments / early drafts)

- `app MVP v1.html` — Strategic Technology Advisory for a multi-service hybrid location platform (phases 1–6: core → social/dating → streaming → commerce → AI → enterprise). Explicitly cut: live streaming, Kafka/GraphQL/microservices-from-day-one, broad ML matching as MVP.
- `технически план.txt` — Early Bulgarian MVP plan (auth, map, area posts, chat, push) + v2–v5+ evolution (marketplace, streaming, matching, community insights, monetization).

## What remains true

- Map-first + real-time + identity verification is the durable product thesis.
- Phased rollout and avoiding feature bloat early was the correct call.

## What was cut / deferred

- Live streaming (infra + moderation)
- Microservices / Kafka / GraphQL / Elasticsearch as default architecture
- Broad ML matching / swipe decks as primary surface
- Enterprise / B2B / white-label as near-term
- Super-app convergence of news, AR navigation, lifestyle assistant, etc.

## Current authority

| Doc | Role |
|-----|------|
| `docs/STATUS_CURRENT.md` | Live implementation + gates |
| `ROADMAP.md` | Sequence and release gates |
| `PRODUCT.md` | What / why / launch market (Varna α) |
| `ARCHITECTURE.md` | System design + privacy invariants |
| `SPECIFICATION.md` | Feature contracts |

Public identity: **NEXA**. Compatibility package/app IDs remain `@g88/*` / `com.g88` until an explicit migration.
