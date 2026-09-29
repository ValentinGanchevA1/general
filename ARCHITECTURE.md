# G88 Architecture

> Companion to `CLAUDE.md` and `docs/STATUS_CURRENT.md`. Keep migration numbers in sync with disk.

## Mobile

- React Native CLI + TypeScript, Redux Toolkit, react-native-maps
- Feature folders under `apps/mobile/src/features/{domain}/`
- Profile presentation: `ProfileView` mode=`self`|`other` + section components under `components/Profile/`
- Theme sole ownership: `apps/mobile/src/theme/index.ts` (ARCHITECTURE §3.13)

## Backend

- NestJS modules, DTOs, TypeORM, PostGIS, Redis, Socket.IO
- Admin Vite app @ `127.0.0.1:5173` (must be in `CORS_ORIGINS`)

## Database

Raw SQL. **0001–0046** on master; **next free 0047**. Dual-0030 resolved. Prefix CI guard.

## Privacy

1. Exact GPS never in DB — H3 r10 centroid at write (except timed chat live-location).
2. Location + tokens never in Sentry payloads.

## Realtime

Socket.IO: presence, chat, verification:updated, friends, stories.

## Changelog (abbrev)

- **2026-09-29** — ProfileView A–D; EntityBottomSheet trust/stats/identity; migrations through 0046; next free 0047.
- **2026-09-14** — Docs restore. listingMode, friendsOnly, MAX_CELLS 5k, map polish, EntityBottomSheet, offers/counter, friends online privacy.
