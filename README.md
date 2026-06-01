# G88

Mobile-first, map-first social platform. Surface nearby people, events, and listings; lightweight interactions (waves, chat, gifts); local commerce and reputation.

## Repository layout

```
g88/
├── apps/
│   ├── backend/        NestJS REST API + Socket.IO realtime gateway
│   └── mobile/         React Native + TypeScript client
├── packages/
│   └── shared/         API DTOs, socket event shapes, geo helpers
├── legacy/             Read-only. Pre-monorepo flat layout. CI ignores. Reference only.
├── docs/
│   └── marketing/      Pitch artifacts — not an engineering source
├── ARCHITECTURE.md     System design, key decisions, rationale
├── STATUS.md           Live P1 progress and reconciliation state
├── CLAUDE.md           AI assistant instructions and conventions
├── PRODUCT.md          Post-P1 roadmap
├── TECH_DEBT_AUDIT.md  Debt backlog
├── render.yaml         Render.com blueprint
└── docker-compose.yml  Local Postgres + Redis
```

This is a pnpm workspace. `@g88/shared` is the single source of truth for API DTOs, socket event shapes, and geo helpers — both the backend and mobile import from it.

## Quick start

```bash
# 1. Install everything
pnpm install

# 2. Bring up Postgres + Redis locally
docker compose up -d

# 3. Backend: run migrations, then start in dev mode
pnpm --filter @g88/backend migration:run   # idempotent — skips already-applied files
pnpm --filter @g88/backend dev

# 4. Mobile: start Metro, then run on a device/simulator
pnpm --filter @g88/mobile start
pnpm --filter @g88/mobile android   # or :ios
```

> **Migrations** are tracked in a `schema_migrations` table. Re-running `migration:run` on a database that already has migrations applied will skip them safely.

## Documentation

| File                 | Contents                                                                    |
|----------------------|-----------------------------------------------------------------------------|
| `ARCHITECTURE.md`    | System design, key decisions, and the things that would otherwise bite us   |
| `STATUS.md`          | Live phase progress, reconciliation verdicts, open questions                |
| `PRODUCT.md`         | Post-P1 feature roadmap                                                     |
| `TECH_DEBT_AUDIT.md` | Ranked debt backlog                                                         |
| `DEPLOY.md`          | Production env vars + migrations per feature (Twilio, Stripe, social OAuth) |

## Current sprint

**P1 is complete** — all six pillars (auth · profile · map discovery · presence · wave · chat) are done and verified. See `STATUS.md` for details.

**P2 hardening (done):** deployed to Render (`g88-api.onrender.com` + Redis), Sentry on both apps, chat outbox retry (C6), map viewport-diff protocol (M1), and a synthetic P1 monitor running every 5 min. The 7-day DoD gate clears **2026-06-06**.

**P3 (in progress):** gamification — XP, levels, and daily streak, plus a daily-challenges system (`GET /challenges/today`, 3 seeded challenges/day, bonus XP on completion); geofence-triggered alert pushes. See `STATUS.md` for the full list.

## Mobile environment variables

Build-time env vars for the mobile app are injected via `babel-plugin-transform-inline-environment-variables` and inlined at Metro bundle time.

```bash
# 1. Copy the template (file is gitignored)
cp apps/mobile/.env.example apps/mobile/.env

# 2. Edit .env — set API_HOST, GOOGLE_WEB_CLIENT_ID, SENTRY_DSN as needed

# 3. Reset Metro's transform cache after any .env change
pnpm --filter @g88/mobile start:reset
```

You can also pass a single variable inline without a `.env` file:

```bash
API_HOST=192.168.1.42 pnpm --filter @g88/mobile android
```

See `apps/mobile/.env.example` for all supported variables and their defaults.

## Verify

```bash
# Type-check (both packages must stay clean)
pnpm --filter @g88/backend typecheck
pnpm --filter @g88/mobile typecheck

# Unit tests
pnpm --filter @g88/backend test
pnpm --filter @g88/mobile test
```
