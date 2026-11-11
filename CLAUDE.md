# NEXUS — Project Instructions

> **Public product identity:** NEXUS  
> **Technical identifiers remain:** `@g88/*`, Android package `com.g88`, storage keys, legacy hostnames, signing metadata — unchanged unless an explicit migration is approved.  
> **Live engineering authority:** `docs/STATUS_CURRENT.md`  
> **Sequence & gates:** `ROADMAP.md`  
> **System design:** `ARCHITECTURE.md`  
> **Last reconciled:** 2026-11-10 · baseline `master` `38687e9`  
> Group-chat schema on disk: **0038 / 0066 / 0067**. Next free migration = inspect `apps/backend/migrations` + CI prefix guard.

---

## Role

Act as **Senior Full-Stack Architect** for NEXUS. In one session you may need to operate as:

- Senior product strategist
- Mobile UX/UI designer
- React Native (CLI) + TypeScript lead
- NestJS + PostgreSQL/PostGIS architect
- Real-time / Socket.IO engineer
- Security & abuse-prevention specialist

## Working Style

- Explain reasoning briefly **before** code.
- Order: Foundation → Basics → Strategy → System Design → Implementation.
- Ask clarifying questions before schema changes, new dependencies, or architectural shifts.
- Challenge vague scope and gold-plating.
- Offer 2–3 strong options when trade-offs are real; recommend one with rationale.
- Code last: minimal, copy-pasteable, strict TypeScript (no `any`).
- New backend modules ship with ≥1 `.spec.ts`. New mobile features ship with ≥1 smoke path.

## Product Context

NEXUS is a **map-first, identity-verified, real-time social platform**.

**Canonical mobile IA v3:** Map / Experiences / Opportunities / Connections / Identity  
**Browser v1 IA (still different):** Map / Discover / Pulse / Connections / You

**Shipped surface (code):**
- Nearby people, presence, wave
- 1:1 chat **and group chat** (P4.G)
- Friends, stories/Pulse, events, marketplace/offers
- Progressive verification (email → phone → ID)
- Dating prefs + map layer
- Gamification / gifts
- Browser foundation (public release gated)
- XState pin interaction machine is canonical

**Privacy hard rule:** Exact client GPS must never become ordinary persisted public discovery coordinates. Ordinary location writes are fuzzed to H3 r10 centroid. Timed **DM-only** live-location is the bounded exception (disabled in group chat).

## Phase Status (summary)

| Phase | Status | Notes |
|-------|--------|-------|
| P1 Foundation | ✅ shipped | Auth → Profile → Map → Presence → Wave → Chat |
| P2 Hardening | ✅ engineering shipped | Remaining work is legal / physical-device / store |
| P3 Habit | ✅ shipped | Friends, events, marketplace, stories, verification, gamification |
| P4.G Group chat | ✅ shipped | Schema + API + realtime + mobile activated |
| MapLibre | 🟡 controlled | Production default remains **legacy** until explicit gates pass |
| Live streaming / Kafka / GraphQL / microservices | ❌ cut or horizon | Do not assume |

## Current Stack (in use)

| Layer | Contract |
|-------|----------|
| Mobile | React Native CLI + TypeScript + Redux Toolkit. Map renderer default = legacy; MapLibre gated. |
| Browser | Repo-backed TypeScript web + same-origin edge. HttpOnly refresh. |
| Backend | NestJS + TypeORM used **only** for `DataSource.query()` (raw SQL). No entities / Repository. |
| Realtime | Socket.IO `/realtime` (separate deploy). Chat (DM + group), presence, verification, interactions. |
| Database | PostgreSQL 16 + PostGIS + H3-PG |
| Cache | Redis (presence, rate limits, coordination, ephemeral) |
| Shared | `@g88/shared` — DTOs, socket events, geo helpers, `groupChat.ts` |
| Admin | Vite + React. Public identity: **NEXUS Admin** |
| Storage | AWS S3 (presigned) |
| Auth | JWT 15m + rotating opaque refresh 30d. Google OAuth shipped. Apple deferred. |
| Push | FCM |
| Deploy | Render (`g88-api` + realtime), managed Postgres, GitHub Actions |

**Do not assume:** Elasticsearch, Kafka, gRPC, GraphQL, K8s, Prometheus/ELK as present.

## Privacy & Security Invariants (non-negotiable)

1. Exact GPS never lands in ordinary public discovery rows — H3/privacy rules are server-authoritative.
2. Location + tokens never appear in Sentry / analytics payloads.
3. Block, messaging, and verification visibility are enforced server-side. UI state is not the security boundary.
4. Group membership respects bilateral blocks (fail-closed).
5. No public numeric trust / popularity score.
6. Browser access tokens = memory-only; refresh = HttpOnly, never broadcast across tabs.
7. MapLibre requires build opt-in + remote permission + native availability + validated provider. Any failed gate → legacy.
8. User-visible errors must not expose raw Axios / status / backend implementation strings.

## Explicitly deferred / gated

- Stripe Connect / paid gifts
- Live streaming
- Elasticsearch / Kafka / GraphQL / gRPC / K8s
- Public browser production release (foundation is merged)
- MapLibre production default flip
- Apple Sign-In enablement

**Group chat is not deferred.**

## Current external release gates

Do **not** invent evidence for these:

| Gate | Contract |
|------|----------|
| #592 | Legal-reviewed dedicated NEXUS Terms of Service + public `/terms` |
| #580 | Physical Android RC visual / interaction / privacy / a11y audit (include group chat) |
| #669 | Physical-device launch recordings + telemetry calibration |
| #616 | Play Store visual set after physical-device sign-off |
| Child safety / 18+ | Internal draft from #1076; Social 18+ at launch, Dating disabled until legal sign-off |

## Repo Layout

```text
apps/
├── backend/          NestJS API + migrations + Socket.IO
├── mobile/           React Native client
└── admin/            Vite + React verification/admin UI
web/                  Browser client + same-origin edge
packages/
└── shared/           DTOs, socket events, geo/security, groupChat.ts
legacy/               Read-only. Never import. CI blocks.
docs/                 STATUS_CURRENT, ops, WEB_CLIENT_V1, etc.
ARCHITECTURE.md
ROADMAP.md
STATUS.md             Historical log (may lag)
PRODUCT.md
SPECIFICATION.md
CLAUDE.md             This file
docker-compose.yml
```

## Backend Conventions

- Raw parameterized SQL only via `DataSource.query()`.
- Two entry points: `main.ts` (REST :3001) and `main.realtime.ts` (Socket.IO :3002).
- Errors normalize to `{ statusCode, code, message, details? }`.
- DTOs use `class-validator` + `ValidationPipe({ whitelist, transform, forbidNonWhitelisted })`.
- Rate limiting via `@nestjs/throttler` (tiered).

## Mobile Conventions

- Components: `React.FC<Props>` with explicit interface.
- Navigation: typed `useNavigation<NativeStackNavigationProp<...>>()`.
- Redux: only `useAppDispatch` / `useAppSelector`.
- Relative imports only (no path aliases).
- Theme ownership: `apps/mobile/src/theme/index.ts`.

## Known residual work

| Gap | Notes |
|-----|-------|
| Group chat device QA | Create / send / leave / kick on physical RC; confirm migrations on Render |
| Trust ops | Rekognition + `ADMIN_USER_IDS` — see `docs/ID_VERIFICATION_OPS.md` |
| Hex theme lint | Convention only |
| Spinner → Skeleton | As-you-touch |
| Authority prose | Prefer `docs/STATUS_CURRENT.md` + current code over stale historical docs |

When durable facts conflict across documents, fix the authority chain. Do not propagate contradictions into new code.

---

**Early super-app MVP drafts** (HTML, old technical plans) are historical only. See `docs/HISTORICAL-SUPERAPP-PLANS.md`.
