# NEXUS WORLDS 2.0 — Map Chrome Prototype

Issue: #1165  
Branch: `feat/nexus-worlds-map-chrome-prototype`

## Decision

Prototype a visual refinement of the existing map surface. Do not introduce a second map, duplicate discovery state, new query lifecycle, or new navigation model. The generated concept is a visual target only—not an exact implementation requirement.

## Existing implementation to reuse

- `MapScreen.tsx`: existing map composition and lifecycle.
- `MapFilterRow.tsx`: search, recenter, entity layers, places, World selector and filters.
- `MapChrome.tsx`: location permission, weather, nudge and challenge chrome.
- `MapWorldSelector.tsx` and `worldModes.ts`: existing World context selector and development gate.
- `nexaSpatialLens.store.ts`: existing session-only lens state.
- `NearbyPeopleRail` and contextual entity sheet: existing nearby/selection surfaces.

## Visual target

- Dark map canvas with restrained cyan/violet accent emphasis.
- Clear hierarchy: search/recenter → entity layers/lens → map → contextual nearby rail → canonical bottom navigation.
- Keep glow limited to active selections and live states.
- Avoid decorative controls that duplicate existing actions.
- Maintain readable contrast and touch targets (minimum 44 pt target where feasible).
- Support small screens, safe areas, dynamic text and reduced motion.

## Non-goals

- No backend, API, schema, PostGIS, H3, Redis or Socket.IO changes.
- No new permissions.
- No duplicate map screen, navigation route, state slice or viewport query.
- No production enablement of World Modes.
- No change to release-critical RC2 behavior.

## Implementation gate

Before code changes, inspect the full current composition and theme primitives, confirm the flag/rollback mechanism, and identify the smallest component-level styling change. Prefer reuse of existing theme tokens over adding a new global palette.

## QA / regression checklist

- [ ] Lens selection uses existing state and causes no duplicate viewport query.
- [ ] Search, layers, filters and World context remain functional.
- [ ] Selected entity and contextual sheet survive visual changes.
- [ ] Camera/viewport state is preserved across tab/detail navigation.
- [ ] Accessibility roles, labels and selected states are intact.
- [ ] Reduced-motion behavior is respected.
- [ ] Small-screen and safe-area layout checked.
- [ ] Android device QA documented (Huawei Nova 11 is one target device).
- [ ] Feature flag/rollback path verified.
- [ ] CI and relevant tests pass.

## Design tokens (prototype-local only)

- Background: `#080D1C`
- Surface: `#11182A`
- Elevated surface: `#19233A`
- Subtle border: `#293653`
- Cyan accent: `#00DFFF`
- Violet accent: `#D36AFF`
- Success: `#34D399`
- Warning: `#FBBF24`
- Danger: `#FB7185`
- Primary text: `#F5F7FF`
- Secondary text: `#AAB3CC`
- Muted text: `#78849F`

These values are design references; prefer existing theme aliases if equivalent.


## Prototype progress

- [x] First isolated styling pass applied to `MapFilterRow.tsx`: slightly improved search field spacing, entity-layer chip spacing and typography, and press feedback.
- [x] Nearby People rail now uses the current theme surface color for its panel, instead of always overriding it with a fixed translucent black.
- [ ] Run mobile typecheck, component tests and Android visual QA before treating this as validated.
- [ ] Review on small-screen layouts and dynamic font scaling.

This pass does not change discovery queries, map/lens state, navigation, backend, permissions or release behavior.
