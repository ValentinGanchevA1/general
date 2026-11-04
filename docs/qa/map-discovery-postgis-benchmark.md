# NEXA Map Core — PostGIS discovery benchmark

**Status:** Opt-in benchmark harness. A passing GitHub CI run is required before reporting numbers. Not a production performance certificate.

## Run modes

- Pull-request workflow `Discovery PostGIS Benchmark`: 10,000 → 50,000 → 100,000 deterministic synthetic map entities (40% people / 30% events / 30% listings). Runs only when benchmark code/workflow changes and uses disposable `postgis/postgis:16-3.4` service.
- Manual `workflow_dispatch` of the same workflow: repeatable full-size profile (10,000 → 50,000 → 100,000). Runs relevance, distance and newest queries with five measurements each; queries are executed against the actual `DiscoveryService`.
- Offline/local: provision PostgreSQL 16 + PostGIS 3.4 on **localhost**, create a disposable database with a name ending in `_bench`, build shared types, then run:

```sh
export DISCOVERY_BENCH_DATABASE_URL='postgresql://nexa_bench:nexa_bench@localhost:5432/nexa_bench'
export DISCOVERY_BENCH_ACK_DISPOSABLE=YES
# Optional quick mode — only 10k
export DISCOVERY_BENCH_QUICK=YES
pnpm --filter @g88/shared build
pnpm --filter @g88/backend exec jest --ci --runInBand --runTestsByPath src/modules/discovery/discovery.benchmark.integration.spec.ts --verbose
```

The runner requires BOTH a deliberate acknowledgment and localhost address / `_bench` database name. Without these guards, the suite is skipped. It never reads or mutates production user data. A uniquely named `map_bench_*` schema is created and dropped in teardown.

## What is instrumented

The benchmark calls the live NestJS `DiscoveryService.nearby` implementation (not a synthetic approximation of its SELECT statements). An instrumented DataSource logs actual SELECT query duration and returned row count. Each SQL query used in a measured run is replayed through `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` and its planning time, execution time, plan nodes, and index names are captured.

The output lines have stable machine-parsable prefixes:

- `DISCOVERY_POSTGIS_BENCH` — dataset size, rank mode, count of samples, p50/p95/max backend-service latency, query timings and PostGIS EXPLAIN summary.
- `DISCOVERY_POSTGIS_CLUSTER_COUNTS` — checked authorized cluster count, number of clusters and effective H3 resolution.

The seed has controlled spatial positions, visibility restrictions, blocked owner/person relationships, a mix of verification tiers, upcoming events and recent listings. The test verifies that no query returns over 500 entity points and that cluster totals match server-authorized data.

## Important limitations

1. This isolates the query shape on one `bench_entities` table exposed through `v_discoverable_entity`. Production's view is a UNION of users, events and listings with owner joins; this suite **does not reproduce those join costs**. For release sign-off, repeat against a production-equivalent migrated schema and data distribution.
2. The recorded p95 is **five local backend-service measurements** in a disposable CI database. It is useful for regressions and explaining query plans, but is not statistically sufficient for the **<=350 ms warm p95 end-to-end** exit gate. A separate load test must measure API, Redis, concurrent viewers, and 4G-like network RTT over a statistically appropriate sample.
3. The Google/Apple/MapLibre renderer, FPS, Android memory and Socket.IO fanout are **not** measured.
4. Service stubs for Friends, Presence and Redis omit external-network latency; production read paths and permissioned values need integration-level profiling.
5. The benchmark is **read/write only inside its disposable schema** (and only installs PostGIS extension when absent). It should never be pointed at production, even with safeguards relaxed.
6. The 10k set is deliberately concentrated inside a single zoom-16 viewport. It is not sufficient to prove dense >500 H3 cluster behavior at regional zoom: the existing `cluster-coverage.spec.ts` tests conservation/coverage separately.

## Acceptance next steps

1. Review CI's 10k p50/p95 and plan summaries, including whether indexes appear and whether repeated scans are excessive. Check for slow JSON extraction and query plan regressions; do not assume index use is always optimal for a densely filled viewport.
2. Trigger a full 10k/50k/100k run via GitHub Actions, store run URL and metric values in the release QA evidence.
3. Repeat against a disposable **fully migrated** NEXA database with realistic user/event/listing owner joins, privacy and permission distributions; compare parallel viewers, cold and warm caches.
4. Carry out device QA with a mid-range Android handset and browser WebGL renderer. Close `Map usable with 10k+ entities` only after DB, API, security, and device gates have passed.
