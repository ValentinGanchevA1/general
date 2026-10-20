# NEXA Map Zoom & Density System v2

This document is the implementation contract for progressive map detail.

## Principles

- The map should reveal detail progressively instead of rendering every label at every scale.
- Server discovery mode and marker visual mode must use the same committed zoom.
- Small zoom-boundary jitter must not repeatedly swap cluster/entity presentation.
- Selected and owned entities must never disappear only because a client density cap is reached.
- Density limits protect native map rendering; they do not change discovery ranking or backend data.

## Runtime zoom source

`MapScreen` already passes an integer map zoom to `useDiscovery`.

`useDiscovery` debounces viewport/zoom changes (250 ms by default). Only when that request is committed does it dispatch `setDiscoveryZoom(zoom)`. `MapMarkers` reads this committed value from Redux.

This gives NEXA temporal hysteresis at zoom boundaries:

1. pinch/pan can oscillate around a threshold,
2. intermediate values are cancelled by the discovery debounce,
3. backend request and marker visual policy change together only after the viewport settles.

The pure `stabilizeDiscoveryZoom()` helper also defines a 0.18 spatial dead-band for a future continuous-zoom MapScreen migration.

## Zoom bands

| Discovery zoom | Band | Backend expectation | Marker presentation | Captions | Max native points |
| --- | --- | --- | --- | --- | ---: |
| `0–8` | Overview | clusters | compact semantic clusters | none | 60 |
| `9–11` | City | clusters | semantic clusters + mixed composition | none | 90 |
| `12–14` | Neighborhood | clusters | full semantic cluster grammar | none | 140 |
| `15` | Local | entities | 18dp compact markers | selected only | 90 |
| `16` | Nearby | entities | 24dp standard markers | selected only | 140 |
| `17+` | Detail | entities | 24dp standard markers | all | 180 |

Selected entity cores still resolve to the canonical 32dp selected size regardless of base density.

## Cluster detail

At Overview scale, mixed-cluster micro geometry is hidden to reduce visual noise. Dominant cluster shape/color and count remain visible.

From City scale onward, mixed clusters expose the `circle / diamond / square` composition row.

Accessibility labels always retain the semantic breakdown even when micro geometry is visually suppressed.

## Density cap

`limitVisibleMapPoints()` keeps incoming server order instead of re-ranking on the client. This avoids marker churn and preserves the backend ranking contract.

When the response exceeds the current band cap, the renderer guarantees preservation of:

- selected entity,
- selected cluster,
- own entity marker.

The cap affects rendering only. Redux discovery data, Pulse/trending calculations and bottom-sheet data still retain the full response.

## Performance contract

- `react-native-maps` never receives more than the zoom band's `maxVisiblePoints` from `MapMarkers`.
- captions are suppressed until useful, reducing marker bitmap size and text layout work.
- compact entity markers use the existing 18dp visual geometry inside the 44dp interaction stage.
- `tracksViewChanges` reopens only when geometry, caption visibility, selection or semantic state changes.
- no continuous per-marker animation is introduced.

## Backend alignment

The shared backend contract remains unchanged:

- `< 15` → H3 clusters,
- `>= 15` → individual entities,
- server hard limit remains 500 points per response.

Client density caps are intentionally lower because native map child rendering has a different performance budget from API transport/storage.

## Acceptance criteria

- Zooming rapidly around 14/15 does not visually alternate cluster/entity mode before discovery debounce settles.
- Zoom 15 uses compact entity markers and only selected captions.
- Zoom 16 uses standard markers and only selected captions.
- Zoom 17+ reveals all entity captions.
- Overview clusters do not render mixed composition micro-glyphs.
- City/Neighborhood mixed clusters do render composition micro-glyphs.
- Marker count never exceeds the active client density cap.
- Selected/own markers survive density capping when present in the discovery response.
- Accessibility semantics are unchanged by visual density reduction.
- No backend DTO or discovery endpoint change is required.
