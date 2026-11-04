# NEXA Map Discovery — pool checkout vs query contention
**Date:** 2026-11-04  
**PR:** https://github.com/ValentinGanchevA1/general/pull/1016  
**Source:** https://github.com/ValentinGanchevA1/general/actions/runs/41839611314  
**P0:** https://github.com/ValentinGanchevA1/general/issues/992

## Purpose and method

The merged opt-in inline-candidate SQL shortcut (#1013) reduced 100k sequential shortlist cost, but did not materially reduce the 10-viewer p95. This test separates two possible causes of waiting: acquiring a PostgreSQL client and executing the SQL against an already acquired connection.

In the disposable local PostgreSQL 16 + PostGIS 3.4 benchmark, TypeORM `QueryRunner.connect()` records client-acquisition time; `QueryRunner.query()` records driver + SQL execution time. The fixture reuses the exact 0063 discoverable UNION view, indexed minimal native source tables, 100k synthetic entities and 10 distinct synthetic requester UUIDs. Explicit pool sizes 2, 5 and 10 use **separate DataSource instances** with the same isolated schema; the JS baseline is computed first. Every request must match its own canonical top-500 JS reference exactly.

Metrics are collected only in the opt-in integration suite. They **do not include** HTTP transport, 4G, mobile rendering, real Redis/Friends/Presence or other application services. Times are from one GitHub-hosted runner, with a single batch per configuration, and are not controlled latency estimates. Client-acquisition and SQL phases overlap among requests, so their percentiles are **not additive**. No raw SQL, bound values, coordinates or requester IDs are logged.

## Observed timings — 100k entities, 10 concurrent requests

| Configured TypeORM pool | Per-request p50 | Per-request p95 | Batch wall time |
|---:|---:|---:|---:|
| 2 | 1472.44 ms | 1656.66 ms | 1693.41 ms |
| 5 | 1440.55 ms | 1544.53 ms | 1580.34 ms |
| 10 | 1241.94 ms | 1513.61 ms | 1542.08 ms |

Measured **pool client acquisition** and **driver/SQL execution**, aggregated across two query phases per request:

| Pool | All-query acquire p95 | All-query execute p95 | Ranking SQL execute p95 | Hydration SQL execute p95 |
|---:|---:|---:|---:|---:|
| 2 | 944.01 ms | 246.04 ms | 258.47 ms | 107.51 ms |
| 5 | 587.90 ms | 620.02 ms | 901.43 ms | 234.25 ms |
| 10 | 35.70 ms | 1358.50 ms | 1362.01 ms | 299.36 ms |

**Interpretation:** A small pool creates a connection checkout queue. Enlarging the pool cuts checkout wait, but the PostgreSQL server takes longer to execute CPU-intensive ranking queries simultaneously. Pool tuning alone makes only a modest difference to batch p95; at pool 10, SQL execution is dominant. A query plan optimized for the single-request case is still contending under high concurrency.

## Integrity checks

- PostGIS suite: **12/12 tests passed** in [run #41839611314](https://github.com/ValentinGanchevA1/general/actions/runs/41839611314).
- Each of the ten viewers returned the exact expected 500 canonical `kind:UUID` IDs at every pool setting (30 concurrent requests asserted).
- Separate established tests still verify privacy filtering, bilateral owner blocks, topics and soft-deleted visibility for JS/SQL/Thin/Inline modes.
- All experimental flags are restored in `finally`; default paths and actual production connection-pool settings were **not** changed.
- The CI run also surfaced an unrelated mobile TypeScript test narrowing error at `NexaWordmark.spec.tsx:25`; the PR includes a minimal test-only explicit null guard.

## Release gate and next work

**Issue #992 stays OPEN.** No production poolSize adjustment is justified from a single synthetic run, and the end-to-end map 350 ms goal remains unproven. Next:

1. Run independently authenticated, representative HTTP clients with a fully migrated disposable schema and live Redis/Friends/Presence, capturing backend per-stage timings and DB resource counters.
2. Profile concurrent ranking SQL on target infrastructure (CPU, Postgres wait events, index use, connection saturation, query plan and buffer pressure), not only local runner latency.
3. Consider bounding database-heavy simultaneous viewport queries, per-request cancellation/coalescing and separately permissioned cache strategies. **Never** share viewer-specific selections across users or weaken block/visibility filtering to gain speed.
4. Complete physical Android MapLibre FPS/memory/pan and 4G round-trip QA before release sign-off.
