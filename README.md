# G88

Map-first, real-time social platform. See nearby people, events, and listings; wave, chat, trade, attend.

| App | Path | Role |
|-----|------|------|
| Mobile | `apps/mobile` | React Native 0.83 client |
| Backend | `apps/backend` | NestJS REST + Socket.IO `/realtime` |
| Admin | `apps/admin` | Vite ID-verification queue (`http://127.0.0.1:5173`) |
| Shared | `packages/shared` | DTOs, socket events, geo helpers |

## Quick start

```bash
pnpm install
docker compose up -d          # Postgres + Redis
pnpm --filter @g88/backend migration:run
pnpm --filter @g88/backend start:dev
pnpm --filter @g88/mobile start
pnpm --filter @g88/admin dev  # optional — admin queue
```

- API: `http://localhost:3001/api/v1`
- Realtime: `ws://localhost:3001/realtime`
- Admin: `http://127.0.0.1:5173` (add to backend `CORS_ORIGINS`)

## Docs (authority order)

| Doc | Purpose |
|-----|---------|
| `STATUS.md` | Where we are / what's next |
| `ROADMAP.md` | Phase sequence and gates |
| `ARCHITECTURE.md` | System design and invariants |
| `SPECIFICATION.md` | Feature contracts |
| `PRODUCT.md` | What / why / launch market |
| `CLAUDE.md` | Agent + contributor conventions |
| `DEPLOY.md` | Render / Play / env (if present) |

**Current phase:** P1–P3 shipped · P4.S Stories shipped · migrations **0001–0040** (next **0041**).  
Privacy: locations fuzzed to H3 r10 (~120 m) at write time — see `ARCHITECTURE.md §3.3`.

## Monorepo

pnpm workspaces. Import contracts only from `@g88/shared`. Never import from `legacy/`.

## License / ops

Internal product. Privacy policy: `https://g88-legal.onrender.com/privacy`.
