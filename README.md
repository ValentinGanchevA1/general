# NEXA

Map-first, real-time social platform for discovering nearby people, events, local activity, and listings — then connecting through lightweight interactions, chat, events, and local trade.

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
| `docs/STATUS_CURRENT.md` | Live implementation state, current gates and migration baseline |
| `ROADMAP.md` | Phase sequence and gates; reconcile older snapshot prose against current status before treating it as live |
| `ARCHITECTURE.md` | System design and invariants; code/shared contracts win if older snapshot details drift |
| `SPECIFICATION.md` | Feature contracts; `packages/shared` and shipped code are field-level truth |
| `PRODUCT.md` | What / why / launch market |
| `CLAUDE.md` | Agent + contributor conventions |
| `STATUS.md` | Historical progress log; not the live status authority |
| `DEPLOY.md` | Render / Play / env (if present) |

**Current phase:** see `docs/STATUS_CURRENT.md` for the live implementation state and migration baseline.  
Privacy: locations are privacy-coarsened to H3 r10 (~120 m) before persistence — see `ARCHITECTURE.md §3.3`.

## Monorepo

pnpm workspaces. Import contracts only from `@g88/shared`. Never import from `legacy/`.

### Compatibility identifiers

NEXA is the public product identity. Existing technical identifiers such as `@g88/*`, Android package/application ID `com.g88`, storage keys, and legacy infrastructure host names are intentionally retained until/unless they receive a separately planned compatibility migration. Do not mechanically rename them as branding cleanup.

## License / ops

Internal product. Canonical public privacy policy: `https://g88-legal.onrender.com/privacy` (legacy-compatible infrastructure URL; hosted content is NEXA-branded).
