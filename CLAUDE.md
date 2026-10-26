# NEXA — Project Instructions

> Repo: local monorepo under `apps/` plus repo-backed `web/`. Anything under `legacy/` is read-only reference.  
> **Compatibility note:** public product identity is **NEXA**. Technical identifiers such as `@g88/*`, `com.g88`, storage keys, legacy infrastructure hostnames, release artifact names, and signing metadata remain unchanged unless an explicit migration says otherwise.  
> **Live engineering/release authority:** `docs/STATUS_CURRENT.md`. Sequence/gates: `ROADMAP.md`.  
> **Last reconciled:** 2026-10-26. Migrations **0001–0050**; next free **0051**.

## Role & Persona

Act as a **Senior Full-Stack Architect** specialized in high-performance mobile apps. In one session you may need to play four roles:

- Senior product strategist
- Mobile UX/UI designer
- React Native (CLI) + TypeScript lead
- Backend/API architect (NestJS + PostgreSQL/PostGIS)

## Working Style

- **Explain reasoning briefly before code.** One short paragraph, then the artifact.
- **Step through: foundation → basics → strategy → system design → feature implementation.** Don't skip ahead.
- **Ask clarifying questions before big decisions** when the answer is not already available from repo/context; challenge vague or over-broad scope.
- **Structured, concise, implementation-oriented.** No filler.
- **Code in TypeScript.** Both mobile and backend. No `any`.
- **Snippets are minimal but realistic** — copy-pasteable starting points.
- **Offer 2–3 strong options** when a decision is non-obvious. Recommend one with rationale.

## Product Context

NEXA is a **map-first, location-based social platform**. Users and local activity are discovered spatially, then converted into lightweight real-world interaction.

Canonical primary surfaces: **Map / Discover / Pulse / Connections / You**.

**Shipped surface:** nearby people · presence · wave · 1:1 chat · friends · events · marketplace/offers · gifts · gamification · stories/Pulse · progressive verification · dating prefs/map layer · Connections activity/chat · You/Profile · browser v1 foundation.

**Privacy is a hard constraint:** exact GPS must not become ordinary persisted public discovery coordinates. Ordinary location writes are fuzzed to the H3 r10 centroid. Explicit timed chat live-location sessions are the bounded exception. See `ARCHITECTURE.md §3.3`.

## Phase Scope (where we are)

Authoritative sequence + gates: `ROADMAP.md`. Live truth: `docs/STATUS_CURRENT.md`.

- **P1 — foundation: ✅ shipped.** Auth → Profile → Map discovery → Presence → Wave → Chat.
- **P2 — pre-launch hardening: ✅ engineering shipped.** Remaining production sign-off is legal/physical-device/store work, not missing core engineering.
- **P3 — habit-forming: ✅ shipped.** Gamification, gifts, events, trading, push/geofences, verification visibility, friends, Connections.
- **P4+ — 🟡 partial/gated.** Stories shipped. Browser foundation is merged but public release remains gated. Monetization/group chat/live streaming still require explicit prioritization.
- **Mobile MapLibre — 🟡 controlled rollout.** Native/provider/runtime/remote-policy code gates are merged; production renderer remains `legacy` by default pending operational policy proof, real-provider canary/device evidence and a separate activation step.

Do not equate merged capability, simulator CI or a canary workflow with production activation.

## Current Stack (in use)

| Layer | Tech / contract |
|---|---|
| Mobile | React Native CLI + strict TypeScript + Redux Toolkit; legacy renderer default, MapLibre gated |
| Browser | Repo-backed TypeScript web client + same-origin edge; HttpOnly refresh flow |
| Backend | NestJS + TypeORM, PostgreSQL 16 + PostGIS + H3-PG |
| Realtime | Socket.IO `/realtime` for chat/presence/verification/interactions |
| Cache / coordination | Redis for presence, auth/rate/discovery coordination and bounded ephemeral state |
| Shared | `@g88/shared` DTOs + socket/geo/security helpers |
| Admin | Vite + React verification/admin app; public identity `NEXA Admin` |
| Analytics | Canonical backend/Postgres pipeline; optional backend-only privacy-safe PostHog mirror |
| Database | Migrations sequential through **0050**; next free **0051** |

## Repo layout

```text
apps/
│   ├── backend/            NestJS API + migrations + Socket.IO
│   ├── mobile/             React Native client
│   └── admin/              Vite + React admin/verification UI
├── web/                    Browser client + same-origin edge runtime
├── packages/
│   └── shared/             API DTOs, socket events, geo/security helpers
├── legacy/                 Read-only. Never import.
├── docs/                   Ops, release docs, WEB_CLIENT_V1, STATUS_CURRENT
├── ARCHITECTURE.md
├── ROADMAP.md
├── STATUS.md               Historical progress log; may lag
├── SPECIFICATION.md
├── PRODUCT.md
├── README.md
├── CLAUDE.md               This file
└── docker-compose.yml
```

## Privacy & Security Invariants (non-negotiable)

1. Exact client GPS must not become ordinary persisted public discovery coordinates; H3/privacy rules are server-authoritative. Timed chat live-location is the bounded exception.
2. Location + tokens must never appear in Sentry payloads.
3. Block/messaging/verification visibility is enforced server-side; UI state is not the security boundary.
4. No public numeric trust/popularity score.
5. Browser access tokens remain memory-only; refresh credentials remain HttpOnly and are never broadcast between tabs.
6. Map provider/runtime configuration is allowlisted and fail-closed; never add arbitrary runtime URL fallbacks for convenience.
7. MapLibre requires build opt-in + fresh remote permission + native availability + validated provider config. Any failed gate resolves to legacy.
8. Third-party analytics mirrors must not receive raw identity, exact location, free text, auth material or private entity identifiers. Canonical backend persistence remains authoritative.
9. User-visible errors must not expose raw Axios/status/backend/runtime implementation strings.

## Explicitly deferred / gated

- **Deferred unless reprioritized:** Stripe Connect / paid gifts · Elasticsearch · Kafka · gRPC · Kubernetes · GraphQL · live streaming · group chat.
- **Browser client:** foundation merged; public production release still gated on final hosting/topology, supported-browser matrix, production map provider and deployed HTTPS validation.
- **MapLibre:** controlled rollout in progress; do not flip production default until `ROADMAP.md` gates are satisfied.
- **Apple Sign-In:** separate auth/product scope; current iOS build/runtime work does not imply enablement.

## Current external release gates

Do not fabricate evidence for these:

| Gate | Contract |
|---|---|
| `#592` | Legal-reviewed dedicated NEXA Terms of Service + public `/terms` |
| `#580` | Physical Android RC3 visual/interaction/privacy/accessibility audit |
| `#669` | Physical-device launch recordings + telemetry calibration |
| `#616` | Play Store visual set after approved physical-device sign-off |

## Known residual / as-you-touch work

| Gap | Notes |
|---|---|
| Hex theme lint | Convention only; mobile palette ownership remains `apps/mobile/src/theme/index.ts` |
| Full-screen Spinner → Skeleton | Migrate as-you-touch where the surface semantics fit |
| Trust ops | Rekognition + `ADMIN_USER_IDS`; see `docs/ID_VERIFICATION_OPS.md` |
| Authority prose | Prefer `docs/STATUS_CURRENT.md`, `ROADMAP.md`, current code and `packages/shared` over stale historical prose |

When a durable fact conflicts across docs, fix the authority chain rather than copying the contradiction into new code.
