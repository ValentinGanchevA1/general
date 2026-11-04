# NEXA Map Core — measured PostGIS benchmark (2026-11-04)

Source: https://github.com/ValentinGanchevA1/general/actions/runs/41738328711
Measured commit: cd2de562c47ddcc1263cb77e5f9775214f221fb2
Environment: GitHub Actions Ubuntu, PostgreSQL 16 / PostGIS 3.4, disposable schema.

| Entities | Relevance p50/p95 (ms) | Distance p50/p95 (ms) | Newest p50/p95 (ms) |
| ---: | ---: | ---: | ---: |
| 10,000 | 198.27 / **205.93** | 50.77 / **55.65** | 41.27 / **41.91** |
| 50,000 | 650.91 / **661.84** | 71.84 / **95.67** | 69.09 / **70.51** |
| 100,000 | 1220.01 / **1246.41** | 111.24 / **113.85** | 110.14 / **111.52** |

Five measured local service+DB requests per mode, after warmup. Five-sample p95 is effectively the maximum, not a statistically robust production SLO.

| Raw entities | Authorized after visibility/block filters | H3 clusters | H3 resolution |
| ---: | ---: | ---: | ---: |
| 10,000 | 9,451 | 27 | 8 |
| 50,000 | 47,256 | 27 | 8 |
| 100,000 | 94,515 | 27 | 8 |

All PostGIS integration tests passed, retaining authorized cluster counts and <=500 returned entity points.

## EXPLAIN ANALYZE at 100k

- Relevance candidate query: 94,515 rows; PostgreSQL execution 288.407ms; query/driver elapsed 389.8ms.
- Relevance hydration of final 500: PostgreSQL execution 424.881ms; query/driver elapsed 426.42ms.
- Hydration plan included Limit, Nested Loop, Gather Merge, Sort, Seq Scan; reported no index names.
- Distance/newest PostgreSQL execution: approximately 98.3/95.9ms.
- A sequential scan is not intrinsically incorrect here because almost every row falls in the selected viewport. Still, the concatenated kind:id hydration predicate lacks a direct UUID-index-eligible filter.

## Next P0 optimization

1. Make top-500 hydration UUID-index-eligible while retaining canonical kind:id validation and every eligibility/block filter.
2. Test cross-kind UUID collisions, permission changes and stable top-K under the exact same query.
3. Re-run this benchmark and compare EXPLAIN, p95 and privacy before merge; then consider server-side rank precomputation if candidate transfer remains costly.

## Scope and release status

This fixture uses one synthetic indexed table exposed as v_discoverable_entity. The real production view is a UNION with owner joins. Redis/Friends/Presence are stubbed, and neither HTTP/4G nor Android/browser FPS is measured. Consequently the Map 10k+ release gate remains OPEN. No production infrastructure/data was touched.