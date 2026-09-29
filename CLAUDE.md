# CLAUDE.md — agent entrypoint for G88

> **Last synced:** 2026-09-29 (ProfileView A–D; EntityBottomSheet trust/stats/identity; STATUS_CURRENT next free **0047**; migrations through **0046**).
> Full product truth: `docs/STATUS_CURRENT.md`. Architecture: `ARCHITECTURE.md`. Roadmap: `ROADMAP.md`.

## Mission

Map-first, real-time, identity-verified social mobile app (people / events / listings on one map).

## Current product phase

- **P1–P3 — shipped.** Auth, map discovery, presence, wave, chat, gamification, gifts, push, verification, events, trading.
- **Post-P3 hardening — largely shipped.** Friends graph, stories, profile origin/cover/identity, ID admin queue, offers/counter, map polish, EntityBottomSheet, listing mode, friends online privacy, friends density, interactions inbox.
- **P4+ — horizon: 🟡 partial.** **P4.S Stories shipped** (incl. video viewer). Monetization, group chat, web client — no go-ahead without explicit ask.

## Current Stack (in use)

| Layer | Tech |
|-------|------|
| Mobile | React Native CLI + TypeScript, Redux Toolkit, react-native-maps; ProfileView self+other |
| Backend | NestJS + TypeORM, PostgreSQL 16 + PostGIS + H3-PG |
| Realtime | Socket.IO (presence, chat, verification) |
| Cache | Redis (presence, OTP, discovery snapshots, presign) |
| Shared | `@g88/shared` DTOs + geo helpers |
| Admin | Vite + React ID queue @ `127.0.0.1:5173` |
| Database | PostgreSQL 16 + PostGIS + H3-PG. Migrations sequential through **0046**; next free **0047** |

## Repo layout

```
apps/
│   ├── backend/            NestJS API + migrations + Socket.IO
│   ├── mobile/             React Native client (src/features/{domain}/)
│   └── admin/              Vite + React ID-verification queue
├── packages/
│   └── shared/             API DTOs, socket events, geo helpers
├── legacy/                 Read-only. Never import.
├── docs/                   Ops + Play listing + STATUS_CURRENT
├── ARCHITECTURE.md
├── ROADMAP.md
├── STATUS.md
├── SPECIFICATION.md
├── PRODUCT.md
├── README.md
├── CLAUDE.md               This file
└── docker-compose.yml
```

## Privacy invariants (non-negotiable)

1. Exact GPS never lands in the DB — H3 r10 centroid at write (except timed chat live-location).
2. Location + tokens must never appear in Sentry payloads.

## Explicitly deferred

Stripe Connect / paid gifts · Elasticsearch · Kafka · gRPC · Kubernetes · GraphQL · live streaming · group chat · web/desktop client. (See `ROADMAP.md` cuts.)

## Known gaps (docs / residual engineering)

| Gap | Notes |
|-----|--------|
| `admin.guard.spec.ts` | Missing dedicated unit spec |
| Events/listings block-by-author | Optional; needs authorId in discovery meta |
| Hex theme lint | Convention only; prefer tokens. **Ownership:** `apps/mobile/src/theme/index.ts` sole mobile palette (not shared). Intentional hex: mapStyle, socialConfig. Toast tints → `colors.toast*`; shadows → `colors.shadowInk` |
| Strike escalation | **Enforced** in stories (phone_required @3, suspend @5); Settings/Profile standing surfaces shipped. Appeal/copy polish optional |
| Full-screen Spinner → Skeleton | Migrate as-you-touch; Marketplace/Friends/Interactions already use Skeleton |
| Trust ops (Render) | Rekognition + `ADMIN_USER_IDS` — see `docs/ID_VERIFICATION_OPS.md` |
