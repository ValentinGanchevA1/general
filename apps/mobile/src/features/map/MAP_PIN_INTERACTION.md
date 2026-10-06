# Pin interaction (Stage 1–3)

## Status
- **Stage-1 PreviewCallout** wired on MapScreen (`PinInteractionHost`)
- **C2a sheet handoff**: Open detail → machine `detailSheet` + `EntityBottomSheet`
- **C2b dual-mode sheet CTAs**: Wave/Message (social) · Like/Pass/Message (dating)
- **C3 full profile**: OPEN_FULL → UserProfile; BACK restores detail sheet
- **B machine-owned sheet CTAs**: sheet Wave/Like/Pass → `SEND_WAVE` / `SEND_LIKE` / `PASS` (no parallel API)
- **C match→chat**: `conversationId` / `datingConversationId` in context; alert + open Chat
- **Wave actor**: real `POST /interactions/wave`
- **loadPin**: real `GET /users/:id`
- **block**: real `POST /blocks/:id`
- **Like / pass**: migration **0047** + DatingModule
- **Specs**: `pinInteraction.machine.spec.ts` (#487)

## Create / FAB (product decision 2026-10-06)

| Control | Role |
|---------|------|
| `MapFilterRow` Create chip | Primary create entry |
| `CreateNearbySheet` | Event / listing / story picker |
| Long-press map | Create at coordinate |
| Empty-state CTA | Activation path |
| GPS recenter FAB | Location only (bottom-right) |
| **`ContextualFab`** | **Deferred** — component kept; **not mounted** on MapScreen. Revisit only if device smoke shows users cannot find create. |

Do **not** wire speed-dial alongside Create chip (chrome collision).

## Stages
| Stage | Machine | UI |
|---|---|---|
| preview | `preview` / `loadingPin` | PreviewCallout |
| detail | `detailSheet` + social/dating viewing (+ pending/sent/matched) | EntityBottomSheet |
| full | `fullProfile` | UserProfile (OPEN_FULL); BACK restores sheet |

## Dual-mode
- `viewerMode` from map Dating layer toggle
- Preview CTAs: Wave (social) / Like (dating) → QUICK_*
- Sheet CTAs: SEND_WAVE / SEND_LIKE / PASS (machine-owned when from MapScreen)

## B / C
- Context holds `conversationId` + `datingConversationId`
- Mutual wave / match → alert with Message → `openRootScreen(Chat, …)`
