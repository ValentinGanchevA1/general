# NEXA Web Production Map Stack — proposed ADR

Status: **Proposed — no runtime/provider switch is authorized by this document**  
Reviewed against public provider documentation: **2026-10-25**

## Context

NEXA is map-first and expects a dense, highly interactive surface with viewport-driven PostGIS discovery, people/events/listing overlays, clusters, realtime deltas and privacy-sensitive usage.

The current browser preview intentionally uses a dependency-free Web Mercator raster renderer and the standard OpenStreetMap tile service. That implementation validates viewport/query lifecycle, but the standard OSM tile service is preview-only and is not the production base-map strategy.

The production choice should keep NEXA's dynamic application data independent from the basemap vendor. People, events, listings, clusters, presence and interaction state remain NEXA-owned application layers sourced from the existing backend; the provider supplies cartographic context only.

## Decision drivers

1. **Renderer independence** — avoid coupling NEXA interaction logic to one commercial map SDK.
2. **Realtime overlay performance** — WebGL/vector rendering must support frequent source/layer updates without reloading the basemap.
3. **Privacy** — never send NEXA user/profile/discovery payloads to a tile provider; provider requests should contain only what is required to fetch basemap/style assets.
4. **Commercial production rights** — explicit commercial terms, attribution rules and predictable usage controls.
5. **Operational escape hatch** — NEXA must be able to change tile hosting without rewriting map interaction logic.
6. **Mobile direction** — prefer a renderer ecosystem that has a native counterpart if NEXA later chooses to align browser/native map rendering.
7. **No tile proxy anti-pattern** — do not route third-party basemap tiles through the NEXA API/edge unless the provider contract explicitly permits it.

## Options

| Option | Strengths | Costs / risks | Fit |
|---|---|---|---|
| **A. MapLibre GL JS + MapTiler Cloud** | Open-source renderer; vector/WebGL; MapLibre Native ecosystem; managed tiles/styles/CDN; commercial plan; easy origin-restricted browser key; provider can be replaced without rewriting NEXA overlays | Paid managed dependency; Flex is usage-based; 99.9% SLA is advertised for Custom rather than Flex; MapTiler terms require direct end-user requests unless proxy use is separately agreed | **Recommended for production beta** |
| **B. Mapbox GL JS + Mapbox-hosted maps** | Mature cartography/tooling; strong web/mobile SDKs; straightforward hosted service; generous published entry tiers | Stronger renderer/provider coupling; proprietary service/SDK terms; migration away is materially larger; NEXA application layer should not become dependent on Mapbox-specific APIs | Good if fastest turnkey cartography outweighs lock-in |
| **C. MapLibre GL JS + self-hosted Protomaps/PMTiles** | Open renderer + open tile archive; direct range requests from object storage/CDN; low vendor lock-in; strong privacy/control; OSM-derived basemap can be hosted in NEXA-selected region | NEXA owns storage/CDN/data-refresh/monitoring pipeline; cartography/data operations become an operational responsibility; PMTiles basemap is read-only and refreshed by replacing archives | **Preferred scale/privacy escape hatch** |

## Proposed decision

Adopt a staged architecture:

### Phase 1 — production beta

Use **MapLibre GL JS** as the browser renderer and **MapTiler Cloud** as the managed basemap/style source.

- Integrate `maplibre-gl` directly; do not make NEXA map logic depend on a provider-specific JavaScript SDK.
- Use vector tiles/styles rather than continuing the preview raster renderer.
- Browser requests go **directly** to the approved MapTiler endpoints; the NEXA edge does not proxy or cache third-party map content.
- Store only a public browser map key, restricted to approved NEXA origins and protected with provider quotas/limits. Never put backend credentials or private tokens in the map config.
- Keep NEXA discovery data in NEXA sources/layers. Do not upload people, private locations, conversations, trust/verification data or realtime presence to the map provider.
- Preserve mandatory provider/OpenStreetMap attribution in a persistent accessible control.
- Start on a commercial plan; if a contractual uptime SLA is required for launch, obtain the provider tier/agreement that explicitly supplies it rather than assuming the standard plan does.

### Phase 2 — portability seam

Introduce one small basemap configuration boundary around renderer setup:

```ts
export type BaseMapSource =
  | {
      kind: 'style-url';
      styleUrl: string;
    }
  | {
      kind: 'pmtiles';
      archiveUrl: string;
      style: MapStyleDefinition;
    };
```

Application layers must not know which basemap source is active. Viewport, discovery, clustering and realtime contracts remain renderer-level/application-level concerns.

### Phase 3 — self-host when justified

Move the basemap to **Protomaps/PMTiles in NEXA-controlled object storage + CDN** when one or more of these triggers is reached:

- managed tile traffic becomes materially more expensive than storage/CDN operation;
- privacy/procurement requires a NEXA-controlled tile delivery path;
- contractual/provider risk becomes unacceptable;
- NEXA needs a controlled OSM snapshot/update cadence or custom basemap layers.

The renderer remains MapLibre, so this migration should change source/style configuration and delivery operations rather than product interaction code.

## NEXA layer architecture

The map should have two independent planes:

```text
┌──────────────────────────────────────────────────────────┐
│ NEXA application layers                                 │
│ people · events · listings · clusters · selections      │
│ Socket.IO deltas · viewport state · contextual creation │
│                 NEXA APIs / PostGIS                     │
├──────────────────────────────────────────────────────────┤
│ Basemap renderer: MapLibre GL JS                        │
├──────────────────────────────────────────────────────────┤
│ Base-map source                                         │
│ MapTiler Cloud initially  ⇄  PMTiles/self-host later   │
└──────────────────────────────────────────────────────────┘
```

Provider switching must never change:

- `POST /discovery/nearby` request/response contracts;
- NEXA clustering semantics;
- identity/privacy rules;
- Socket.IO event contracts;
- viewport debounce/abort behavior;
- selected entity / bottom-sheet state.

## Security and privacy requirements

- Do not send raw device coordinates to a basemap vendor as application telemetry. Normal tile requests necessarily reveal requested map areas and client network metadata; this must be reflected in the privacy/vendor review.
- Provider analytics/telemetry that is not required for tile delivery should be disabled where the selected integration permits it.
- Restrict public browser keys by NEXA origins and provider quota controls.
- Do not embed privileged provider credentials in the bundle.
- Do not server-side cache, redistribute or proxy provider tiles unless the selected contract explicitly permits it.
- Keep CSP explicit: only the selected style/tile/glyph/sprite origins should be added.
- Attribution must remain visible/readable and accessible on small screens.
- NEXA application coordinates continue to obey existing server-side location privacy/coarsening rules; a better basemap must not increase exposed user precision.

## Performance requirements

Before replacing the preview renderer, the implementation PR must demonstrate:

- no discovery request on every animation frame; authoritative queries still occur only after settled viewport state;
- stale discovery requests remain abortable;
- NEXA overlay updates do not rebuild/reload the basemap style;
- server clusters remain authoritative where the backend returns cluster points;
- map interaction remains responsive with representative people/event/listing density;
- renderer/source teardown is deterministic when navigating/unmounting;
- map rendering respects reduced-motion/accessibility behavior where animation is introduced.

## Commercial / legal checks before runtime adoption

### MapTiler

Current public documentation reviewed on 2026-10-25 states:

- Free is for testing/PoC/personal/non-commercial use and commercial product R&D within its terms;
- Flex is listed at **USD 30/month** plus usage;
- extra 2D map sessions are listed at **USD 2.50 / 1,000 sessions** and API requests at **USD 0.15 / 1,000 requests**;
- Custom advertises a **99.9% SLA** and volume terms;
- Cloud terms permit temporary end-user device caching but prohibit server-side proxy/cache redistribution unless separately agreed;
- MapTiler/OpenStreetMap attribution requirements apply.

These numbers/terms are planning inputs, not a price guarantee. Re-check them before purchase or launch.

### Mapbox

Current public pricing reviewed on 2026-10-25 lists Mapbox GL JS map loads with a free tier up to 50,000 monthly loads, followed by usage-based tiers. Mapbox remains a valid alternative if its turnkey cartography/SDK ecosystem is preferred, but this ADR does not recommend coupling the NEXA renderer to the provider at this stage.

### Protomaps / PMTiles

Current Protomaps documentation describes:

- PMTiles as a single-file tile archive read through HTTP Range Requests;
- OSM-derived basemap builds intended to be copied to your own cloud storage rather than hotlinked from build downloads;
- a full planet archive of roughly 120 GB for the documented basemap build;
- direct MapLibre integration via the PMTiles protocol;
- OpenStreetMap attribution obligations for the OSM-derived basemap.

## Sources reviewed

- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- MapTiler Cloud pricing: https://www.maptiler.com/cloud/pricing/
- MapTiler Cloud terms: https://www.maptiler.com/terms/cloud/
- MapTiler general terms / attribution: https://www.maptiler.com/terms/
- Mapbox pricing: https://www.mapbox.com/pricing
- Mapbox terms: https://www.mapbox.com/legal/tos
- Protomaps documentation: https://docs.protomaps.com/
- Protomaps PMTiles + MapLibre: https://docs.protomaps.com/pmtiles/maplibre
- Protomaps basemap downloads: https://docs.protomaps.com/basemaps/downloads
- Protomaps licensing/attribution: https://protomaps.com/legal

## Acceptance gate for an implementation PR

Do not replace the preview renderer until the implementation PR includes:

1. explicit provider account/key configuration and origin restrictions;
2. CSP changes limited to required map asset origins;
3. attribution UI verified on desktop/mobile layouts;
4. a renderer adapter that keeps discovery/realtime contracts provider-independent;
5. real-browser viewport race regression coverage still passing;
6. representative performance validation;
7. updated privacy/vendor documentation;
8. confirmation of the commercial plan/SLA needed for the intended release stage.
