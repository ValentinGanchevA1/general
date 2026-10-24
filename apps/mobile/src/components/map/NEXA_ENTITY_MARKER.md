# NEXA Entity Marker v3

Canonical mobile map marker contract.

## Geometry

| Entity | Shape | Semantic color |
| --- | --- | --- |
| Person | Circle | Violet / action |
| Event | Four-point star | Cyan / discovery |
| Listing | Square | Neutral |
| Opportunity / other | Diamond | Violet / opportunity |

This is the same circle / star / square / diamond vocabulary used by the NEXA launch and hero compositions.

Visual bounding sizes are 18dp compact, 24dp standard, and 32dp selected. The marker interaction stage is never smaller than 44×44dp.

The rendered marker is 88×62dp when a caption is present. `NEXA_MARKER_ANCHOR_Y` keeps the geographic coordinate centered on the 44dp marker stage rather than the full captioned bitmap.

## State modifiers

States are composable rather than separate marker implementations:

- `selected` — 32dp core + violet outer focus ring; highest z-index.
- `live` — cyan discovery ring; currently derived from privacy-gated online presence for people.
- `verified` — cyan ring/check badge.
- `isNew` — small cyan discovery dot.
- `own` — thin violet ownership ring.
- `dimmed` — 42% opacity for contextual/filter de-emphasis.
- `unavailable` — 35% opacity + diagonal neutral slash; takes opacity precedence over dimmed.

`selected`, `live`, `verified`, `isNew`, and `own` may coexist.

## Map integration

`EntityMarker.tsx` adapts current shared `EntityPoint` contracts without changing backend DTOs:

- `user` → `person`
- `event` → `event`
- `listing` → `listing`

`MapMarkers.tsx` owns native `react-native-maps` snapshot lifecycle and re-enables `tracksViewChanges` only when painted visual state changes. Media URLs are intentionally excluded from marker visual keys because v3 markers are geometry-first and do not paint avatar/cover/thumbnail images.

`MapMarkers` supports both controlled selection (`selectedEntityKey`) and a local last-tapped fallback. It also exposes `newEntityKeys`, `ownEntityKey`, `unavailableEntityKeys`, and `dimUnselected` for map orchestration.

## Performance rules

- Do not use endless JS pulse animation inside every native map marker.
- Live is represented by a static cyan ring in the marker snapshot; realtime change still triggers a single native re-snapshot.
- Keep marker child trees small and media-free.
- Selected/live/own/new entities receive higher native z-index; ordinary entities remain at the base level.

## Accessibility

Entity markers expose a single semantic image label including entity name/type and relevant live/verified state. Shape remains meaningful without color.
