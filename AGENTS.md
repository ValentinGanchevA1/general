# Agent Instructions

Use this file as a quick operational reference for coding agents working on this repo.

## Document authority

- `ARCHITECTURE.md` — system-level decisions and invariants
- `ROADMAP.md` — sequence and gating
- `SPECIFICATION.md` — feature-level contracts
- `STATUS.md` — current implementation reality

## Working constraints

- do not import from `legacy/`
- do not drift mobile and backend contracts
- do not persist exact location data
- keep admin-only routes behind admin guard logic
- prefer data-minimizing, privacy-safe patterns

## Before changing docs

Update the relevant files if a work item changes product phase, operational status, or design rules.

## Changelog
- 2026-09-13 — replaced the stale audit-era material with concise agent guidance for the active repo.