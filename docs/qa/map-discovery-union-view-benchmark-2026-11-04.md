# NEXA Map Core — discovery UNION view benchmark (2026-11-04)

**PostGIS run:** https://github.com/ValentinGanchevA1/general/actions/runs/41775295481
**Branch:** `test/discovery-union-postgis-benchmark-20261104`
**Migration definition:** `apps/backend/migrations/0063_marketplace_kind.sql` — exact final `CREATE OR REPLACE VIEW v_discoverable_entity` statement, loaded from repository at runtime.

## Design

- PostgreSQL 16 + PostGIS 3.4, localhost-only disposable `_bench` database with isolated named schema and teardown.
- Physical `users`, `events` and `listings` source tables; host and seller foreign keys, PKs, per-source H3 indexes (r7–r10), spatial GiST, and the exact 0063 UNION view projection.
- 625 deterministic H3 positions and 40% users / 30% events / 30% listings, seeded progressively to 10k, 50k and 100k records.
- Includes private users/events/listings, deleted users/events/listings, sold listings, two-directional viewer blocks, owner joins and listing expiration.
- Five post-warmup `DiscoveryService.nearby` timings for each mode, EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), exact top-500 canonical `kind:UUID` membership comparison and authorized H3 count verification.

## Measured findings

| Raw rows | Authorized count after privacy/eligibility filters | JS relevance p95 | Guarded SQL relevance p95 | Improvement |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 9,624 | 205.91 ms | **169.61 ms** | 17.6% |
| 50,000 | 48,137 | 667.17 ms | **530.16 ms** | 20.5% |
| 100,000 | 96,276 | 1203.94 ms | **969.64 ms** | 19.5% |

All eight benchmark tests passed in the linked run. At every size, SQL and JS selected the same 500 canonical `kind:UUID` identities. Both ranking paths used the unchanged user/event/listing source authorization and hydration guard; counted authorized clusters were 27 at each synthetic density.

At 100k, query-level EXPLAIN recorded:

- JS candidate projection: 96,276 rows; ~613 ms PostgreSQL execution and ~700 ms driver/query elapsed.
- SQL top-K shortlist: only 500 rows returned, but ~911 ms PostgreSQL execution and ~859 ms driver/query elapsed. The generated plan traversed UNION/owner joins and included sequential scans.
- Typed final hydration: 500 rows; ~60 ms PostgreSQL execution on this multi-table view (versus ~3–4 ms in the simplified single-table test).

**Important:** explain execution measurements were recorded by separately replaying selected queries after the timed runs. They are not strict components of the measured service latency; compare their query shapes and plans, rather than summing them.

## Impact

Moving relevance scoring into PostgreSQL reduces Node-side transfer but **does not remove** the per-candidate scan and the cost of constructing JOIN/JSON metadata in this view. The 100k p95 remains ~970 ms even in local service+database conditions. The 350 ms warm end-to-end map objective remains **OPEN**. SQL mode stays opt-in and disabled by default.

### Recommended next implementation

1. Investigate two-stage, privacy-safe candidate extraction from source-specific tables before building full JSON metadata. Keep real block/visibility/owner semantics at selection and at hydration.
2. Compare execution plans and SQL total time for source-specific ranking projections or an explicitly maintained discovery index/read model versus the current UNION view.
3. Introduce latency/concurrency sampling on a fully migrated disposable schema and real socket/Redis/API paths; then physical Android MapLibre FPS and memory tests.

## Scope constraints

The view statement is authentic and loaded from migration 0063. The backing tables are *minimal projections* with relevant columns, joins and indexes, not the full collection of schema migrations or triggers. Data is synthetic, evenly concentrated inside one viewport, running on a GitHub Actions worker with five samples per mode, no concurrent viewers or mobile transport. Thus this is production-shaped evidence, **not** a production p95 guarantee or permission to enable a feature flag.