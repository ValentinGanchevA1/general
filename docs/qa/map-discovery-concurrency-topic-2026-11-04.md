# Discovery SQL top-K — topic/privacy and concurrent requests (2026-11-04)

**PR:** https://github.com/ValentinGanchevA1/general/pull/1011  
**Source:** https://github.com/ValentinGanchevA1/general/actions/runs/41830090356  
**Issue:** https://github.com/ValentinGanchevA1/general/issues/992

## Reproducible environment

PostgreSQL 16 / PostGIS 3.4 in a localhost-only disposable database named `nexa_bench`, isolated benchmark schema, seeded with 10k/50k/100k records. The fixture loads the exact `v_discoverable_entity` view from migration 0063, and the canonical `g88_slugify` function from migration 0023. Underlying tables are simplified indexed `users`, `events`, and `listings` projections; this is **not** a fully migrated release schema.

The benchmark is `DiscoveryService.nearby` + PostgreSQL only: Friends, Presence and Redis are mocked. No HTTP, internet, device, cluster of application instances or real authenticated users are involved. The two experimental flags are restored after each test and remain disabled by default.

## Correctness and privacy gates

**All 11/11 tests passed** across the two PostGIS suites. New checks compare JS, existing SQL and the thin SQL shortlist against the same view and seed.

- Exact topic match `#event-42`, using canonical SQL slug function; one expected event is returned.
- Owner blocks in either direction, `visibility='private'` and soft-deleted event state each make the topic result empty in all three ranking implementations.
- Removing restrictions restores the authorized result; no state/permission leak from previous queries.
- Listing category `#general` with `listingMode='sell'` and `marketplaceKind='for_sale'` returns exactly the same **500 typed IDs** across JS/SQL/thin.
- Ten concurrent synthetic requesters each receive exactly the same **500 canonical (kind,UUID) IDs** as their sequential JS reference.

## Single-request comparison — 100k synthetic records

| Algorithm | p95 (5 samples) |
|---|---:|
| JavaScript ranking | 1316.54 ms |
| Previous SQL shortlist | 1051.73 ms |
| Thin native-column SQL | **537.27 ms** |

At 100k, EXPLAIN (ANALYZE, BUFFERS) for the thin shortlist reports ~470.68 ms PostgreSQL execution, plus the selected 500-row hydration ~65.75 ms PostgreSQL execution in separately replayed plans. These plan executions must not be summed into a purported HTTP latency.

## Concurrent load — 100k synthetic records

Ten *distinct synthetic requester UUIDs* against the same viewport launched concurrently. Sequential JS references were computed first; the parallel batch used guarded Thin SQL.

| Metric | Measured |
|---|---:|
| Concurrent requests | 10 |
| Requests with exact canonical parity | 10 / 10 |
| Per-request p50 | **2447.06 ms** |
| Per-request p95 | **2637.80 ms** |
| Total batch wall time | **2678.85 ms** |

Percentiles use only ten per-request samples (p95 is the highest sample), on a shared GitHub runner, not a statistically representative production SLA. Requests used mocked Friends/Presence/Redis, so this is database contention evidence, not actual websocket/app/HTTP concurrency coverage.

## Outstanding P0 exit gates

1. **350 ms end-to-end target not met.** Single-query 100k p95 ~537 ms and ten-request p95 ~2638 ms are both above it before network overhead.
2. Profile PostgreSQL contention under concurrent viewports using repeated warm/cold runs and more realistic source distributions; inspect plan costs, CPU/memory and source-specific H3 indexes.
3. Validate the exact constraints, views, triggers, permissions and owner relationships of a **fully migrated** disposable database. The simplified fixture cannot establish production-schema equivalence.
4. Test real API + Redis + Presence with at least 10 independently authenticated clients, followed by physical Android MapLibre panning/zoom, FPS and memory measurements.
5. Keep **`DISCOVERY_SQL_TOPK` and `DISCOVERY_THIN_SQL_TOPK` disabled** until explicit release authorization and rollback criteria are documented.

This PR introduces only additional test coverage and a QA report; it does not enable experimental modes or modify public API behavior.
