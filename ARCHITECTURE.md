# G88 Architecture

Map-first, real-time, identity-verified social + local marketplace monorepo.

## 1. Monorepo layout

| Path | Role |
|------|------|
| `apps/mobile` | React Native (TypeScript), Redux Toolkit, Socket.IO client |
| `apps/backend` | NestJS, PostGIS, Redis, Socket.IO gateway |
| `apps/admin` | Vite + React + shadcn — ID verification queue |
| `packages/shared` | DTOs, socket events, pure helpers (no UI palette) |

## 2. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Mobile | RN + TS | Strict TS, no `any` |
| API | NestJS | Modules, DTOs, guards |
| Data | Postgres 16 + PostGIS + H3-PG | |
| Cache | Redis | Presence, OTP, discovery snapshots, presign |
| Realtime | Socket.IO | Presence, chat, verification |
| Shared | `@g88/shared` | Cross-app types |

## 3. Database

Raw SQL. **0001–0046** on master; **next free 0047**. Dual-0030 resolved. Prefix CI guard.

## 3.13 Theme ownership

`apps/mobile/src/theme/index.ts` is the sole mobile palette.

## 4. Privacy

1. Exact GPS never in DB — H3 r10 centroid at write (except timed chat live-location).
2. Location + tokens never in Sentry payloads.

## Changelog (abbrev)

- **2026-09-29** — ProfileView A–D; EntityBottomSheet trust/stats/identity; migrations through 0046; next free 0047.
- **2026-09-14** — Docs restore. Migrations 0001–0046 / next 0047. listingMode, friendsOnly, MAX_CELLS 5k, map polish Option 1, EntityBottomSheet, offers/counter, friends online privacy. Privacy invariant unchanged.
