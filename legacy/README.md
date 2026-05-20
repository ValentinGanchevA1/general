# `legacy/` — Frozen pre-monorepo layout

> **Status:** Read-only. Reference only.
> **Frozen on:** 2026-05-14 (`git tag legacy-freeze-2026-05-14`)
> **Why this exists:** archaeology. Pre-monorepo domain logic, UI flows, and form validation rules sometimes inform decisions in the new layout.

## Do not import from here

Importing from `legacy/` into `apps/` or `packages/` is forbidden:

- ESLint blocks it (`no-restricted-imports` with the `**/legacy/**` pattern in `apps/mobile/.eslintrc.js` and `apps/backend/.eslintrc.js`).
- CI blocks it (`scripts/ci/check-no-legacy-imports.sh` runs on every push/PR).
- `pnpm-workspace.yaml` excludes `legacy/**`, so workspace tooling can't resolve it as a package either.

If you find yourself reaching for `legacy/`, the right move is to **port or rebuild** the relevant piece into `apps/` according to the verdicts in `STATUS.md`.

## What's in here

```
legacy/
├── mobile/             Pre-monorepo React Native client
│                       (flat src/, Redux thunks against old REST routes,
│                        TypeORM-style entities expected from backend)
├── backend/            Pre-monorepo NestJS API
│                       (TypeORM entities, 17 feature modules including
│                        gifts/gamification/trading/verification/etc.)
└── README.md           This file
```

## Reconciliation verdicts

Each legacy module has been assigned one of **PORT**, **REBUILD**, **DROP**, or **DEFER**. See `STATUS.md` § "Reconciliation Verdicts" for the full table.

Quick recap:
- **Map / discovery / presence / waves** — already rebuilt in `apps/` (better than legacy).
- **Auth** — partially rebuilt; OAuth + rotating refresh still TODO.
- **Profile / chat / users / notifications** — to be ported or rebuilt in Phase R2–R3.
- **Trading / events / payments / verification** — deferred behind feature flags.
- **Gifts / gamification / skills / trending / analytics** — dropped.

## When can `legacy/` be deleted?

Once **all** of the following hold:

1. `STATUS.md` Definition of Done for P1 is met (synthetic checks green for 7 days).
2. Every PORT and REBUILD verdict is marked complete in `STATUS.md`.
3. No one has opened `legacy/` in `git log --since="3 months ago" -- legacy/` for a quarter.

Until then it stays. The cost of keeping it is ~negligible (no CI runs against it, no resolver touches it). The cost of losing the reference is non-trivial — old UI flows and form rules are easier to read than to re-discover.
