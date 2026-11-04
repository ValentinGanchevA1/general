# NEXA Map Core — guarded SQL relevance top-K (2026-11-04)

**PR:** https://github.com/ValentinGanchevA1/general/pull/990  
**Initial PostGIS benchmark:** https://github.com/ValentinGanchevA1/general/actions/runs/41769790597  
**Prerequisites:** #987 (PostGIS benchmark), #989 (indexed kind-safe hydration)  
**Runtime flag:** `DISCOVERY_SQL_TOPK=1` (off by default).

## Why

With #989, selecting and hydrating the final 500 `(kind, id)` rows became index-friendly (~3–4 ms database execution at 100k), but the first relevance query still returned ~94,515 lightweight candidates into Node.js, followed by JS ranking/sorting.

The new guarded implementation calculates distance, trust, social, freshness, activity and kind multipliers **inside PostgreSQL**, returning at most 500 `(kind, id)` identities. Hydration rechecks the existing visibility, bilateral owner blocks, H3 viewport and filtering predicates. The SQL selection is only used for non-dating relevance; dating continues to use the existing mutual-eligibility selection before the cap.

## Initial measured baseline — same CI runner and same synthetic data

| Synthetic records | JS relevance p50/p95 | SQL relevance p50/p95 | SQL candidate shortlist rows |
|---:|---:|---:|---:|
| 10,000 | 110.63 / 117.21 ms | 90.20 / **93.24 ms** | 500 |
| 50,000 | 407.05 / 458.08 ms | 314.73 / **316.43 ms** | 500 |
| 100,000 | 788.20 / 793.53 ms | 578.75 / **586.91 ms** | 500 |

Five post-warmup `DiscoveryService.nearby` samples per mode; p95 is effectively the sample maximum. The integration test compares the **exact selected canonical key set** (`kind:id`) between the legacy JavaScript path and the new SQL path at each dataset size. The first full run passed (4/4 tests).

At 100k, `EXPLAIN ANALYZE` reported ~596 ms SQL top-K execution in this representative query plan, versus ~281 ms for the old raw candidate projection alone plus Node.js transfer/scoring. The new path reduces total service latency in this synthetic case but leaves the database as its main cost.

## Privacy and correctness invariants

- Visibility is public and bilateral blocked owners are excluded **before** ranking; hydration repeats the same filters. Neither aggregate counts nor leaderboard ordering should expose blocked or private rows.
- Only the `FriendsService.listWhoAllowFriendsOnline` permissioned friend subset is queried for online/last-seen ranking signals. Non-permissioned friends are treated as offline with no visible last-seen data.
- A result is identified by **kind and UUID together**, not UUID alone. Hydration uses typed UUID arrays and rechecks authorization.
- Freshness uses server time for upcoming events and listing creation time. The SQL formulas track `ranking/scoring.ts`, but they remain a separate implementation that must be parity-tested after future scoring changes.
- `datingOnly` always falls back to the pre-existing mutual-preference filtering path before top-K.
- The runtime default remains unchanged. Production rollout of `DISCOVERY_SQL_TOPK` needs feature approval and observation/rollback controls.

## Release gates still open

1. Complete the opt-in friend/permission/presence parity and cross-kind collision integration tests (follow-up run).
2. Compare on a **fully migrated production-equivalent view** (users/events/listings UNION with real owner joins), not just the simplified synthetic fixture.
3. Measure backend p95 with concurrency and caches (Redis/Friends/Presence), then full HTTP latency on a mobile network; target p95 ≤350 ms for the relevant warm-map discovery flow, not merely a locally measured Postgres query.
4. Measure physical Android pan/zoom FPS, map snapshot/cluster stability and memory at realistic viewport densities. No release sign-off from synthetic tests alone.

**Status:** SQL ranking is experimental and off by default; benchmark improvement is real for the tested dataset, but 100k local p95 (~587 ms) is still above a 350 ms end-to-end target.
