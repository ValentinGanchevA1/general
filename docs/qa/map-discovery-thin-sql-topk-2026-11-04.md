# Map Core — thin source-specific SQL shortlist (2026-11-04)

**PR:** https://github.com/ValentinGanchevA1/general/pull/1002  
**GitHub Actions:** https://github.com/ValentinGanchevA1/general/actions/runs/41819171575  
**Tracking:** https://github.com/ValentinGanchevA1/general/issues/992

## Feature gate

The optimization activates only when **both** `DISCOVERY_SQL_TOPK=1` and `DISCOVERY_THIN_SQL_TOPK=1` are set. Both are off by default. `datingOnly` still uses the existing mutual-preference filtering path before top-K.

The SQL shortlist reads only native ranking columns from `users`, `events`, and `listings` rather than building the `v_discoverable_entity` JSON metadata for every candidate. The final hydration query still uses the canonical, authorization-filtered discovery view and kind+UUID pairs; it independently rechecks all eligibility and block predicates.

## Repeatable PostgreSQL/PostGIS benchmark

The integration fixture uses the **exact 0063 UNION view SQL**, backed by indexed minimal source tables, 625 deterministic positions, and 40% users / 30% events / 30% listings. Five warm service+database requests per mode and size; reported p95 is the maximum of five samples, not a production confidence interval.

| Raw entities | JS p95 | Legacy SQL top-K p95 | Thin SQL top-K p95 | Improvement vs legacy SQL |
|---:|---:|---:|---:|---:|
| 10,000 | 226.38 ms | 198.32 ms | **138.36 ms** | 30.2% |
| 50,000 | 698.12 ms | 625.46 ms | **316.58 ms** | 49.4% |
| 100,000 | 1374.41 ms | 1100.69 ms | **566.59 ms** | 48.5% |

PostGIS workflow passed **9/9 tests** across the original and UNION suites. At 100k, the new shortlist returned only 500 typed identities (rather than returning every candidate to Node.js). EXPLAIN on the thin shortlist reported about **472 ms** of PostgreSQL execution, compared with **1,026 ms** on the previous JSON-building SQL top-K query. The final 500-row hydration remained approximately **65 ms** in this fixture.

The benchmark also asserts exact canonical `kind:UUID` top-500 set parity for **JS, SQL, and thin SQL**, including source-kind filters, listing buy/sell intent, and marketplace kinds.

## Eligibility and privacy invariants

- The requester sees only public content; bilateral `user_blocks` apply to user IDs, event host IDs and listing seller IDs **before** ranking.
- Excludes soft-deleted users/events/listings, sold or expired listings, and old events in line with the actual 0063 view.
- Requires event host and listing seller to exist, matching the original view's INNER JOIN semantics.
- Honors H3 requested cells, requested kinds, topic slug, friend IDs, listing mode and marketplace kind. Query placeholders bind requester-specific values; H3 column identifiers are strictly allowlisted.
- Users' ranking coordinates are snapped to the existing `0.02`-degree grid. No raw precise user location is returned to the client from shortlist SQL.
- Final hydration uses the unchanged authenticated view filter and canonical `(kind,id)` constraint; a block, visibility or deletion change between selection and hydration cannot authorize data.
- Presence online/last-seen is only incorporated via the existing friend permission checks in `DiscoveryService`.

## Limitations and follow-up gates

1. **No production rollout:** 100k local backend p95 (567 ms) is still greater than the intended 350 ms **end-to-end** latency. Both flags must remain disabled until sign-off.
2. Although the view SQL comes directly from migration 0063, the test uses minimal synthetic source tables and no actual concurrency, Redis load, HTTP transport, 4G, or real Android FPS.
3. Topic-query integration parity and full historical migration coverage need separate production-equivalent validation. The new builder unit-tests topic bindings, but this benchmark does not exercise an actual hashtag filter.
4. Next optimization should profile remaining H3 scans and final JSON hydration under parallel requests, then instrument backend/query metrics and Android map interactions.
