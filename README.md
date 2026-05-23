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

| File | Contents |
|---|---|
| `ARCHITECTURE.md` | System design, key decisions, and the things that would otherwise bite us |
| `STATUS.md` | Live P1 pillar progress, reconciliation verdicts, open questions |
| `PRODUCT.md` | Post-P1 feature roadmap |
| `TECH_DEBT_AUDIT.md` | Ranked debt backlog |
| `apps/backend/README.md` | Backend-specific setup, env vars, migrations |
| `apps/mobile/README.md` | RN setup, native module notes, build commands |

## Phase 1 scope (current sprint focus)

Auth → profile → map discovery → presence → wave → chat. Everything else (marketplace, events, verification pipeline, gamification) lives behind feature flags until P1 is shipping cleanly.
