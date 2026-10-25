# Map v1 — Definition of Done

Status owner: Map / Discovery

This document records the code-level acceptance evidence for Map v1. It intentionally separates automated/code guarantees from the one acceptance item that requires a physical Android device.

| DoD item | Status | Evidence |
|---|---|---|
| Viewport state survives tab/detail navigation | ✅ | `MapScreen` is the long-lived Map tab; `preSheetRegionRef` restores the pre-detail region and full-profile back re-presents the selected entity context. |
| People / Events / Listings are explicit layers | ✅ | `MapFilterRow` + `EntityKind[]` drive discovery kinds. |
| One selected entity / contextual surface | ✅ | `selectedMarkerKey` is controlled by `MapScreen`; user pin preview and entity sheet are mutually handed off. |
| Nearby surfaces do not compete with entity context | ✅ | Nearby people and Trending already hide for `sheetOpen`; `EventsRail` now subscribes to selected-entity visibility and hides while contextual selection is active. |
| Stable cluster behavior | ✅ | H3 server clustering, zoom-band density, progressive reveal, selected z-index, cluster tap zoom. |
| Wave optimistic feedback | ✅ | `usePinInteraction` exposes `waveSent` while `social.wavePending` and rolls back automatically if the XState actor fails. |
| Wave is duplicate/retry idempotent | ✅ | `WaveIdempotencyService` collapses duplicate sender/recipient/context commands in Redis before `InteractionsService.wave` reaches the Postgres transaction. |
| Blocked/hidden people are excluded server-side | ✅ | Discovery SQL requires `visibility = 'public'` and applies symmetric `user_blocks` isolation before response construction. |
| Person location is privacy-transformed | ✅ | Presence fuzzes to the H3 r10 centroid before Postgres persistence and realtime fan-out. |
| Panning cannot flood discovery API | ✅ | 250 ms client debounce, request abort, exact-key suppression, oversized viewport refusal, server cell caps, controller throttling. |
| Realtime presence is spatially scoped | ✅ | Socket membership is scoped to H3 r8 `cell:*` rooms; presence deltas fan out only to affected old/new cells. |
| Back/dismiss restores Map context | ✅ | Pre-sheet camera region is restored; full-profile back returns to the entity detail state. |
| Empty/error/network failure remains usable | ✅ | Map stays rendered; `NexaMapSpatialStatus` covers empty/error/stale-error/refreshing/zoom-in with retry instead of replacing the map. |
| Android mid-range performance smoke | ⚠️ Device validation | Code has marker caps, H3 clustering, progressive reveal and controlled `tracksViewChanges`; final acceptance still requires a physical mid-range Android run. |

## Automated validation

PR CI must pass:

- backend ESLint
- backend typecheck
- backend Jest
- backend build
- mobile ESLint
- mobile typecheck
- mobile Jest
- Android build workflow

## Physical Android smoke checklist

Use a mid-range Android device and verify:

1. Cold launch to Map; map becomes interactive without a blocking overlay.
2. Pan/zoom continuously for 30–60 seconds; no visible request-loop flicker or marker thrash.
3. Switch Map → Pulse → Map repeatedly; camera/filters remain unchanged.
4. Select user/event/listing; only one contextual surface is visible and `Events Near You` is hidden.
5. Dismiss detail; camera returns to the exact pre-selection region.
6. User → full profile → back; entity context returns.
7. Send Wave under normal network; UI acknowledges immediately and settles to success.
8. Double tap/retry Wave; only one durable Wave is created.
9. Simulate network loss; existing markers remain when available and retry UI is actionable.
10. Verify blocked user never appears after discovery refresh.

A physical device smoke result should be recorded before marking Map v1 fully released.
