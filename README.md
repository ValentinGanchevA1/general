# G88

Mobile-first, map-first social platform. Surface nearby people, events, and listings; lightweight interactions (waves, chat, gifts); local commerce and reputation.

## Repository layout

```
g88/
├── apps/
│   ├── backend/   NestJS REST API + Socket.IO gateway
│   └── mobile/    React Native + TypeScript client
└── packages/
    └── shared/    Types and contracts shared by both apps
```

This is a pnpm workspace. The `@g88/shared` package is the single source of truth for API DTOs, socket event shapes, and geo helpers — both the backend and mobile import from it.

## Quick start

```bash
# 1. Install everything
pnpm install

# 2. Bring up Postgres + Redis locally
docker compose up -d

# 3. Backend: run migrations, then start in dev mode
pnpm --filter @g88/backend migration:run
pnpm --filter @g88/backend dev

# 4. Mobile: start Metro, then run on a device/simulator
pnpm --filter @g88/mobile start
pnpm --filter @g88/mobile android   # or :ios
```

## Documentation

- `ARCHITECTURE.md` — system design, key decisions, and the things that would otherwise bite us later.
- `apps/backend/README.md` — backend-specific setup, env vars, migrations.
- `apps/mobile/README.md` — RN setup, native module notes, build commands.

## Phase 1 scope (current sprint focus)

Auth → profile → map discovery → presence → wave → chat. Everything else (marketplace, events, verification pipeline, gamification) lives behind feature flags until P1 is shipping cleanly.
