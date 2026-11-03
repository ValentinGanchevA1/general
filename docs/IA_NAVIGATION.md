# NEXA navigation v3 — canonical map-first information architecture

> Runtime authority: `apps/mobile/src/navigation/AppNavigator.tsx`, `nexaTabIdentity.ts` and `nexaSpatialLens.store.ts`.
> Updated: 2026-11-04.

## Five visible destinations

| Tab | Role | Interaction contract |
|---|---|---|
| Map | Primary live spatial home | People, places, events, listings and Pulse signals in the current viewport |
| Experiences | Spatial lens | Opens **the existing Map** with event layer selected; map camera and gesture history are preserved |
| Opportunities | Spatial lens | Opens **the existing Map** with listing layer selected; trading permissions and backend rules unchanged |
| Connections | Private relationship work | Chats, waves, pending actions; only actionable unread badge |
| Identity | Profile and trust | Verification, account, achievements, settings and map presence |

NEXA exposes five *navigation controls* and only **one live map instance**. On press, Experiences and Opportunities switch the active spatial lens and navigate to the Map route. The active lens is reflected in tab icon/label styling. Manually changing map layer chips switches to `custom` without overwriting the user's filters. Pulse is a contextual live signal and existing dedicated activity viewer, **not** a primary tab.

## Compatibility

Legacy `Main → Pulse`, `Main → Discover` and `Main → You` route names remain registered as hidden tabs to support existing push payloads, notifications, and source callers. They never appear as a sixth visible item. New UI must use `Map | Experiences | Opportunities | Connections | Identity`. Existing `Interactions` root re-entry stays routed to `Main → Connections`.

## Invariants

- The map viewport is not reset by switching between the three spatial navigation controls.
- Map discovery continues to rely on the existing server-authoritative viewport query, PostGIS filters, and Socket.IO privacy rules.
- Spatial lens changes must not request additional permissions or introduce new location persistence.
- Tab navigation is never an authorization boundary for chats, events, offers or verification.
- Only Connections may show an actionable numeric badge. Map novelty is signaled on-map.
- A11y: labels present, target width >= 44dp, text auto-shrinks rather than overflowing on narrow phones. Spatial lens selection is explicitly reflected in accessibilityState.selected, not only icon colors.
- Do not rename existing backend endpoint names or older push payload route values as part of this visual IA migration.

## Regression tests

- Five primary tabs appear in the correct order; no Discover/Pulse/You navigation items are visible.
- Experiences selects events on the same Map; Opportunities selects listings; Map restores ordinary discovery.
- Manual map layer choice is respected as a custom lens; tapping Experiences again filters events.
- Old notifications that navigate to Pulse still open Pulse with their existing filters.
- Connections unread badge and legacy Interactions re-entry are preserved.
- Test accessibility on small Android displays and with enlarged system fonts.
