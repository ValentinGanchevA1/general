# Pin interaction (Stage 1–3)

## Status
- **Stage-1 PreviewCallout** wired on MapScreen (`PinInteractionHost`)
- **C2a sheet handoff**: Open detail → machine `detailSheet` + `EntityBottomSheet`
  - Prefer viewport `EntityPoint`; if peer left viewport, seed minimal user point from machine lat/lng + profile name
  - Sheet dismiss → machine `DISMISS`
  - User pin tap → machine only (no parallel sheet open)
- **C2b dual-mode sheet CTAs**: Wave/Message (social) · Like/Pass/Message (dating)
- **C3 full profile**: OPEN_FULL → UserProfile; BACK restores detail sheet
- **Wave actor**: real `POST /interactions/wave`
- **loadPin**: real `GET /users/:id`
- **block**: real `POST /blocks/:id`
- **Like / pass**: client + migration **0047** + DatingModule

## Stages
| Stage | Machine | UI |
|---|---|---|
| preview | `preview` / `loadingPin` | PreviewCallout |
| detail | `detailSheet` + social/dating viewing | EntityBottomSheet |
| full | `fullProfile` | UserProfile (OPEN_FULL); BACK restores sheet |

## Dual-mode
- `viewerMode` from map Dating layer toggle
- Preview CTAs: Wave (social) / Like (dating)
- Sheet CTAs: Wave/Message (social) · Like/Pass/Message (dating)

## C3
- EntityBottomSheet `onOpenFull` → MapScreen sends OPEN_FULL + navigates UserProfile
- `suppressPinDismissRef` avoids machine DISMISS while navigating to full
- Map `useFocusEffect` on return → BACK + re-present sheet
