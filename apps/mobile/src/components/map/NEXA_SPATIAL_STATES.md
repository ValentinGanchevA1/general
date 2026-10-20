# NEXA Empty / Loading / Error States v2

The map remains the primary product surface. Recoverable discovery states are overlays on top of the map, not replacement screens.

## State contract

| State | Trigger | Presentation |
| --- | --- | --- |
| `starting` | map region not ready | centered discovery card |
| `loading` | first discovery request, no points yet | centered discovery card |
| `refreshing` | request in flight with existing points | compact non-blocking pill |
| `empty` | local/city-scale request completed with zero points | contextual spatial empty card |
| `error` | request failed and no cached points exist | retry card over the live map |
| `stale-error` | refresh failed but prior points still exist | compact warning pill; stale markers remain visible |
| `zoom-in` | discovery rejects an oversized viewport | zoom guidance + one-tap zoom action |
| `ready` | normal map discovery | no state overlay |

Raw network/backend error messages are never rendered in map copy.

## Empty-state semantics

Empty copy follows the active context instead of showing one generic message:

- Friends → show everyone.
- Dating disabled → open dating preferences.
- Dating has no matches → clear Dating filter.
- For-sale / wanted → create locally.
- Unverified email → open Trust Center.
- Default quiet area → create the first local event/listing/wanted/alert.

Copy describes the current **view**, never an exact address or coordinate.

## Progressive marker reveal

The first dense marker set is staged to avoid a single native bitmap burst:

- first 28 map children are immediately eligible to render;
- +32 every 70ms;
- maximum still comes from the existing zoom-density policy;
- selected / own entities remain preserved even when they fall outside the current reveal batch;
- Reduced Motion reveals the full allowed set immediately;
- reveal count is not reset on every pan/refresh, which avoids repeated flicker and marker churn.

This is a render-only optimization. Discovery data in Redux / hook state is never truncated.

## Error policy

Recoverable discovery errors do not unmount `MapView`.

- Existing points stay visible after a failed refresh.
- Retry reuses the current viewport and active filters.
- No raw `ApiError`, request URL, PostGIS detail, or location coordinate is surfaced to the user.
- The only full replacement fallback is a genuine map-renderer crash caught by the existing `ErrorBoundary`; a crashed native map cannot remain interactive.

## Motion and accessibility

- State entrance uses the canonical NEXA standard timing.
- Reduced Motion resolves to a short opacity-only transition.
- Buttons keep 44dp+ effective targets.
- Loading uses branded geometry and copy instead of a generic spinner.
- Live-region announcements describe state changes without announcing coordinates.

## Acceptance criteria

1. Initial discovery no longer renders a centered `ActivityIndicator`.
2. Empty discovery keeps the map visible and shows contextual NEXA copy.
3. A failed first request exposes a retry action without raw backend error text.
4. A failed refresh keeps existing markers and shows a compact warning.
5. Oversized viewports explain that the user should zoom in rather than appearing empty.
6. Dense first-load markers reveal progressively and respect Reduced Motion.
7. No backend, Socket.IO, PostGIS, shared DTO, or exact-location persistence contract changes.
