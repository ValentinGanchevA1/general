# NEXA — Map Core: Interaction & Discovery Engine (10k+)
Status: **Proposed engineering contract; not yet 10k-validated**
Priority: **Critical / P0 for map-first experience**
Scope: Mobile (React Native; existing legacy renderer, gated MapLibre) + Web (MapLibre when production provider is approved) + NestJS/PostGIS/H3/Redis/Socket.IO
Baseline: `master` on 2026-11-04. Normative existing contracts remain in `SPECIFICATION.md`, `packages/shared`, `docs/MAP_V1_DOD.md`, and `apps/mobile/src/components/map/NEXA_MAP_ZOOM_DENSITY.md`.

## 0. Goal and explicit assumptions
A user can pan/zoom a viewport with **>=10,000 eligible raw entities** (people, events, listings) and obtain a responsive, privacy-safe map without rendering 10k native markers or losing map coverage. This is a **load/acceptance target**, not a claim already demonstrated.

Assumptions to validate during QA:
- Discovery is **viewport-based**, not unrestricted global feed; the app does not need all raw entities at once.
- User location is opt-in and already privacy-transformed on the server; the viewer's map center is not proof of their GPS position.
- One selected pin/bottom sheet at a time; the selected/owned pin survives density truncation.
- The existing `POST /api/v1/discovery/nearby` and shared `DiscoveryResponse` remain the v1 protocol.
- The H3 source of truth is the server. Browser and native renderers do not recluster server cluster responses.

## 1. Map interaction specification

### 1.1 Pin density / progressive detail (retain existing mobile policy)
| Integer zoom | Mode | Visible marker cap (mobile) | Presentation | Label |
|---|---|---:|---|---|
| 0–8 | H3 clusters | 60 | compact semantic clusters | none |
| 9–11 | H3 clusters | 90 | cluster count + category geometry | none |
| 12–14 | H3 clusters | 140 | full cluster grammar | none |
| 15 | entities | 90 | compact 18dp pin | selected only |
| 16 | entities | 140 | standard 24dp pin | selected only |
| 17+ | entities | 180 | standard 24dp pin | all (subject to overlap) |

- Native 44dp minimum effective target; selected visual core 32dp and front-most z-order.
- Preserve selected entity/cluster and own pin when present in **authorized** response. Never invent a missing pin client-side.
- Do not display thousands of markers: incoming discovery response hard cap is currently 500; mobile renderer imposes a lower density cap. Use progressive reveal (28 initially, +32 every 70ms), except Reduced Motion.
- Web MapLibre uses one application GeoJSON source + style layers and `setData`/feature updates; do not create a DOM marker per entity or reload basemap on discovery changes. Set explicit web visible-feature budget based on profiling; default proposal <=500 features.
- Preserve stable ids as `kind:id` / `cluster:cellId`. Keep selection anchored across refresh unless blocked, invisible, deleted, or outside the authorized viewport.

### 1.2 Cluster strategy
- Reuse `h3ResolutionForZoom` from shared geo. The authoritative split is **zoom <15 clusters, zoom >=15 entities**.
- Server aggregates *only authorized, eligible* entities with `count` and `by:{user,event,listing}`. A category is dominant at >=65%; otherwise show neutral/mixed geometry. Cluster count is not an online-user count.
- Never sort out all low-density geographic areas merely because one dense cluster has a higher count. Introduce a **spatially balanced selection** when >500 cells would be returned: preferentially preserve viewport coverage; optionally coarsen H3 one resolution and return the **actual** response resolution. Do not silently pretend a truncated cluster set covers the entire viewport.
- A cluster tap smoothly recenters and zooms toward the cluster until it expands; preserve immediate selection ring and accessible description. H3 cell ids should not be reused as identity across resolutions.
- Keep the current 5,000 H3-cell enumeration safety budget. Oversized or invalid viewports return an explicit `zoom-in` state (existing client presentation) rather than a misleading empty-area claim.
- Required edge tests: overlapping entities, 10k all in one H3 cell, 10k spread across >500 cells, antimeridian, equatorial/high-latitude bounds, zoom 14/15 oscillation, rapid pan away/back, selected pin crossing a cluster boundary.

### 1.3 Viewport refresh rules
1. Map camera moves locally at native/browser frame rate; **do not fetch during every frame**.
2. On settle: mobile debounce 250ms, web 220ms (existing values). Use committed integer zoom; avoid 14/15 thrashing via existing zoom hysteresis.
3. Reissue if viewport materially changes, integer zoom changes, filter/rank changes, explicit refresh happens, or the snapshot becomes stale. Normalize coordinates/key precision to prevent insignificant subpixel changes creating distinct requests; do not incorrectly merge different authorization contexts.
4. Abort previous HTTP request immediately when a newer query becomes authoritative. A monotonically increasing request generation also prevents late/reordered results from committing.
5. If query is identical and fresh, do not fetch again; if stale, show retained markers with a non-blocking refreshing indicator.
6. Apply response `diff` only against the matching baseline `prevViewportHash`; if missing/expired or incompatible, request/accept a full snapshot. Reconcile Socket.IO mutations that arrived after request start; keep transport snapshot separate from live Redux state.
7. Existing server throttling is 30/min/user. Design client dedupe/coalescing to stay below this on realistic pan gestures. On 429 apply bounded backoff + visible non-blocking retry; never run an automatic request loop.
8. When the viewport is too broad or device/network fails, keep the basemap interactive, retain only still-authorized cached pins, and show `zoom-in`, `stale-error`, or retry copy—never a blank/replaced map.

### 1.4 Map caching policy
| Data | Proposed policy | Invalidation/security |
|---|---|---|
| Viewport HTTP snapshot (client) | Memory-only LRU, max 8 distinct query contexts, 15s fresh / 120s stale-while-revalidate **targets** | Key by viewer/session, normalized viewport, zoom, kinds, filters, rank, privacy mode, schema version; purge on logout/account switch/block/privacy changes; stale people must not survive permission revocation. No persistent device cache of private people. |
| Server diff baseline | Keep existing Redis `discovery:snap:{requester}:{hash}`, TTL 30s | Used **only** for response diff, **not** as proof the raw DB query is cached. Never reuse between viewers. |
| Server aggregate cache (future) | Initially **do not introduce** cross-viewer cache for privacy-filtered people/counts. If profiling requires it, only cache viewer-safe/public static inputs with auth filtering after lookup. | Avoid blocked/hidden-person count leakage; invalidate on publish/edit/delete/visibility change. |
| Base map tiles | Provider-defined browser/SDK cache only | Honor provider terms and attribution; never mix map vendor tiles with user discovery payloads. |

Cache size and TTLs are proposals to validate with memory profiling and privacy review. Fail closed on auth/visibility changes even if this reduces cache hit rate.

### 1.5 Live updates
- Reuse authenticated `discovery:subscribe` and `discovery:unsubscribe`, H3 r8 spatial rooms, and `discovery:entity:enter/update/leave`.
- Backend resolves visibility, symmetric blocks, online preferences, dating/friends filters and location coarsening **before** fan-out. Subscription membership alone is not authorization to receive an entity.
- Dedupe by canonical entity key + monotonically ordered revision when available; coalesce bursts within ~100–250ms, apply to Redux/source incrementally, and avoid full basemap/style reloads.
- Keep cluster counts **HTTP authoritative** until a server-authoritative aggregate-delta protocol is designed. In zoom<15 or complex filter modes, schedule bounded snapshot refresh after relevant invalidation rather than modifying counts client-side.
- On reconnect, token rotation, foreground resume, missed sequence or room change: resubscribe and fetch full/validated-diff snapshot. Ignore events from old subscriptions and forbid stale-event resurrection after blocks/deletion.
- No exact person coordinates, forbidden online state, or raw location precision in sockets/analytics. For performance telemetry record aggregate latency/count metrics, not per-user coordinates.

## 2. Discovery Engine

### 2.1 Hard eligibility gates — before ranking or counting
Apply on the server:
- Geographic viewport/H3 intersection, active kinds, category/topic/listing/dating/friends filters.
- `visibility='public'` and any product-specific eligibility (published, not expired, available, etc.).
- Symmetric block exclusion for user and event/listing owner, removed/deactivated account protections, user-controlled presence/privacy.
- Consent-compatible, viewer-safe shared-interest/connection features. Never expose another person's exact GPS or non-consented interests.
- Events in the past and sold/unavailable listings require an explicit product rule; do not rank them as immediately actionable by default.

### 2.2 Ranking modes and v2 relevance design
Keep API modes `relevance | distance | newest`. Only `relevance` uses multi-signal score. `distance` is strict geographic ascending; `newest` is domain-aware timestamp descending, each with stable `kind:id` tie-break.

**Proposed relevance weights (not yet implemented):**

| Signal | Weight | Normalization (0..1) | Safeguard |
|---|---:|---|---|
| Distance | 0.30 | `1 / (1 + distanceMeters / 500)` (distance from **viewport center**, not presumed viewer location) | Geospatial candidate selection cannot hide far-but-relevant in-viewport items. |
| Recency / temporal relevance | 0.20 | Type-specific time decay: upcoming events near start; listing creation/activity; permitted person recency. | Missing timestamp neutral; never infer hidden online status. |
| Shared interests / intent | 0.20 | Jaccard-style matching of **visible, user-consented** interests and purpose/intents; bounded, normalized. | Neutral cold-start baseline; do not infer sensitive traits. |
| Trust / verification | 0.15 | Verified tier + positive safety signals if approved; never publish internal abuse score. | New, legitimate accounts remain discoverable; no buyable trust boost. |
| Popularity / quality | 0.10 | Saturated and time-decayed **unique** legitimate attendee/save/reply engagement. | Anti-Sybil, bot/rate-limited, exposure-bias cap; never raw views/waves. |
| Social proximity | 0.05 | Existing friend/approved connection only. | No disclosure of hidden friend graph. |

`score = Σ(weight * normalizedSignal)`, clamp 0..1, deterministic tie-break by canonical entity key. Missing signals use a documented neutral prior; compare candidate mixes across people/events/listings for fair representation, not opaque hardcoded category multipliers. Score should be computed server-side and versioned internally (`rankingVersion`). Avoid personalized detailed score fields in public payloads.

**Current baseline differs:** `ranking/scoring.ts` uses distance .35, trust .25, friend/social .20, freshness .12, activity .08 and kind multipliers. Shared interests and popularity are **not** yet modeled in that scorer. Do not mark v2 ranking shipped without DTO/source feature work and tests.

### 2.3 10k candidate correctness — critical backend fix
Current `DiscoveryService.entitiesInCells` applies SQL `LIMIT 500` before the relevance/newest in-process sort (and distance uses SQL KNN). That means a top-scoring item outside the first 500 SQL rows can never be shown in a 10k viewport.

**Required change before exit:**
- Filter eligible entities in PostGIS/H3 first, then obtain a spatially fair candidate pool (e.g. per-cell quota + diverse kind/time strata) or push computable rank features into SQL and take the **global** top-K before `LIMIT 500`.
- Rank **before** final response/renderer cap, not after arbitrary id-based truncation. Do not fetch all 10k full profile/interest objects into Node or run N+1 per entity.
- Precompute low-cost rank features (time, interest tokens, trust tier, abuse-filtered popularity, type, cell, geometry) in dedicated table/materialized projection when needed; batch or SQL-join viewer features; use parameterized predicates and indexed location/H3 columns.
- Use `EXPLAIN (ANALYZE, BUFFERS)` on production-like seeded volume; ensure no unexpected sequential scans, oversized H3 enumerations, or high-cardinality JSON expansion per viewport request.
- Deterministic top-K and stable ordering; test 10,000+ candidates where the best scorer has a late UUID/ID to prove it is not dropped. Include density fairness test across H3 cells.
- Proposed staged rollout: first correct `relevance/newest` prelimit bias with existing signals; then introduce interests/popularity behind a feature flag and compare ranked outcomes before broad release.

### 2.4 Endpoint / state contract
Existing request (compatibility preserved):
```ts
type DiscoveryRankBy = 'relevance' | 'distance' | 'newest';
type DiscoveryQuery = {
  viewport: { ne: {lat: number; lng: number}; sw: {lat: number; lng: number} };
  zoom: number;
  kinds?: Array<'user' | 'event' | 'listing'>;
  rankBy?: DiscoveryRankBy;
  prevViewportHash?: string;
  // Existing topic/listingMode/marketplaceKind/friendsOnly/datingOnly also apply.
};
```

`POST /api/v1/discovery/nearby` returns authorized `points` **or** `diff`, `resolution`, `viewportHash`, `generatedAt`. Existing server hard cap = 500 returned points; UI has lower limits. Any proposed `rankingVersion` is an internal metric first, not an unannounced breaking response change.

## 3. Scalability, privacy and threat model
- Spatial indexes: verify B-tree on each H3 resolution used for filtering and GIST/geography for distance. Query plan must be demonstrated with seeded 10k/50k/100k, not assumed.
- Burst/rate safety: 30/min/user current API limit, bounded H3 cells (5,000), request cancel, Redis socket room quotas/backpressure; ensure many simultaneous subscribers do not produce quadratic fan-out.
- Hotspot resilience: 10k entities in one cell must produce one correct aggregated cluster at zoom<15; close-up must page/rank instead of causing native marker explosion.
- Privacy: user public coordinates are server-coarsened; no exact-location analytics; block and privacy changes must invalidate old snapshots and prevent socket resurrection. Aggregate counts themselves must respect viewer-specific exclusions.
- Correctness: antimeridian crossing, longitude span of exactly 360°, 0-area bounds, high-latitude H3 estimation, zero shared interests, clock skew, conflicting event timestamps, identical lat/lng, type id collision, filter changes during in-flight request, offline reconnect.
- Abuse: no direct verification/status privilege from popularity; unique-engager caps, coordinated spam resistance, owner block isolation, rate-limited waves and opportunistic listing spam.

## 4. Definition of Done / acceptance gates

**Reproducible dataset**
- Fixed seed & distribution: **10,000 eligible entities in one tested viewport** (4,000 people / 3,000 events / 3,000 listings), including 1 concentrated hotspot and many sparse cells; 50k/100k database rows for query-plan stress.
- Include 10% blocked/hidden/expired/ineligible rows outside the eligible pool, varied verification/freshness/interests, and changed live activity; ensure seeded identity/interaction fixtures are not production data.

**Performance targets (proposed, must measure)**
| Metric | Pass threshold | Measurement |
|---|---|---|
| Settled gesture -> first authorized discovery response | p95 <=700ms cold, <=350ms warm at tested network profile | Backend + HTTP + client, separately record API duration; 4G-like 80ms RTT fixture |
| Panning/zoom rendering smoothness | >=55 FPS median and <=100ms p95 tap-to-feedback in defined Android mid-range + Chrome profiles | 60s pan/pinch, Android frame metrics + Chrome Performance |
| Renderer point budget | Mobile 60/90/140/90/140/180 by zoom; web <=500 default | Instrumented visible source/marker count |
| HTTP query storm | No per-frame queries; <=30 requests in any rolling minute per viewer under scripted 60s pan workload | Network trace + backend throttle events |
| Live update propagation | p95 <=2s for authorized foreground entities in entity zoom | Published mutation -> visible eligible pin update |
| Memory / stability | No OOM, crash, lost viewport, duplicate markers or accumulating listeners during 10-minute repeat pan/zoom | Android profiler + browser memory snapshot |
| Privacy correctness | 0 blocked/invisible/unconsented points or counts; no reappearance after revoke/logout | Backend, socket, replay and device tests |

**Functional CI**
- Unit: zoom density, 65% cluster dominance, H3 resolution, stable selection, spatial-balanced budget, temporal ranking and missing-signal priors.
- Integration/Postgres: 10k candidate ranking before cap, block/visibility filtering before cluster counts, user/event/listing ownership blocks, explain-plan budget.
- Socket: leave/enter/update authorized fanout, staleness after unsubscribe, burst coalescing, reconnect/snapshot resync, stale event cannot revive removed user.
- App/browser E2E: pan→abort→latest response; zoom 14→15; tap cluster→zoom; select person→sheet→back; filters during pan; 429/offline/retry; memory/marker count.
- Physical device: mid-range Android legacy map **and** separate MapLibre gated canary; do not turn on production MapLibre solely to pass this feature. Browser Chrome on desktop/mobile viewport, with approved production tile stack.
- Report includes test commit, DB seed, device model/OS, renderer, traffic model, 95th percentiles, network trace, screenshots and explicit pass/fail.

## 5. Implementation slices (PR plan)
1. **P0 — correctness & metrics:** instrument query latency/count/diff/visibility; add 10k seed + Postgres ranking correctness test; fix pre-LIMIT bias for relevance/newest; verify spatial coverage for 500-cluster cap.
2. **P0 — density/caching/realtime convergence:** keep existing mobile density, add safe memory-only viewport cache with invalidation, ensure burst and reconnect reconciliation; source-level web updates, no basemap reload.
3. **P0 — relevance v2 & QA:** add shared interests and fraud-resistant popularity feature projection, feature-flagged weighting, evaluate fair kind mix and cold start; run mid-range Android + browser 10k test, record measured exit gate.

## 6. Decisions / constraints to confirm
- Is 10k the **eligible entities inside one viewport** acceptance workload (recommended), or only total database population? This spec uses the stricter viewport interpretation.
- Which mid-range Android device and web browser matrix establish the launch baseline? Existing physical Android release QA remains a gate.
- Is cross-category ranking desirable, or should a chosen People / Events / Listings layer remain separate? Current API supports explicit layer filtering; weighted relevance is primarily meaningful within a layer.
- What consent/visibility rules allow the Interest and Purpose fields to be used for matching? Unapproved/private interests must not enter a rank feature or response.
- Event temporal rules (upcoming/ongoing/past) and marketplace status rules (sold/expired/wanted) must be product-defined before recency becomes hard exclusion.

**Exit status: OPEN.** An authored spec and existing Map v1 code are not a passing 10k benchmark. Close only with the reproducible perf + privacy + correctness evidence above.
