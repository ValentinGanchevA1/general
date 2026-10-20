# NEXA Map Chrome v2

## Purpose

The map is the product. Chrome must help users discover, filter and recover location without visually competing with map entities.

## Primary stack

The primary map chrome is pinned directly below the safe area:

1. **Search nearby** — 48dp
2. **8dp gap**
3. **Semantic layer row** — 44dp

Total primary height: **100dp**.

Supporting weather/trending/challenge/nudge content starts below this stack through `mapChromeLayout.ts`; feature screens must not hard-code vertical offsets around it.

## Semantic controls

- Search / location recovery → **Discovery cyan**
- Filters / ranking / people actions → **Action violet**
- People layer → **Violet circle semantics**
- Events layer → **Cyan diamond semantics**
- Listings layer → **Neutral semantics**

No legacy pink/orange/green category colors should be introduced into map chrome.

## Interaction rules

- Every actionable map control has a minimum **44dp** hit target.
- At least one discovery layer must remain active.
- Layer controls are horizontally scrollable; Filters and Locate remain fixed and reachable.
- Active advanced filters are summarized with a compact count badge.
- Search can be cleared with one action.
- Press feedback is subtle (`opacity + 0.97 scale`), not bounce-heavy.
- Locate is a discovery action and therefore uses cyan, not violet.
- Filter completion is an action and therefore uses violet.

## Search scope

`MapScreen` currently filters the already-loaded viewport entity payload client-side. This PR exposes that existing behavior through the canonical **Search nearby** control; it does **not** introduce a new backend full-text/geospatial search contract.

At cluster zoom levels the backend response contains cluster aggregates rather than searchable entity metadata. Full server-side viewport search should be implemented as a separate discovery contract so this visual migration does not silently alter ranking, privacy or query load.

## Advanced filters

The filter modal owns:

- relevance / distance / newest ordering
- friends-only and dating filters when People is enabled
- listing mode when Listings is enabled
- local alert entry point

Alert creation is intentionally moved out of the always-visible layer row to keep the primary spatial controls focused.

## Accessibility

- Controls expose button/search roles and selected states where relevant.
- Active filter count is included in the Filters accessibility label.
- Search focus has a cyan border, so focus is represented by both state and geometry/color contrast.
- Text uses theme tokens and supports the existing dark/light theme system.

## Non-goals

This iteration does not:

- change discovery API DTOs
- change PostGIS/H3 clustering
- add server-side text search
- change map marker geometry
- add new navigation destinations
- request location permission from the chrome itself beyond the existing recovery flow
