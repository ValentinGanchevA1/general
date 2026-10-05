# Pin interaction (Stage 1–2)

## Status
- **Stage-1 PreviewCallout** wired on MapScreen (`PinInteractionHost`)
- **C2a sheet handoff**: Open detail → machine `detailSheet` + `EntityBottomSheet`
  - Prefer viewport `EntityPoint`; if peer left viewport, seed minimal user point from machine lat/lng + profile name
  - Sheet dismiss → machine `DISMISS`
  - User pin tap → machine only (no parallel sheet open)
- **Wave actor**: real `POST /interactions/wave`
- **loadPin**: real `GET /users/:id`
- **block**: real `POST /blocks/:id`
- **Like / pass**: client + migration **0047** + DatingModule

## Stages
| Stage | Machine | UI |
|---|---|---|
| preview | `preview` / `loadingPin` | PreviewCallout |
| detail | `detailSheet` | EntityBottomSheet |
| full | `fullProfile` | UserProfile (C3 — not machine-driven yet) |

## Dual-mode
- `viewerMode` from map Dating layer toggle
- Preview CTAs: Wave (social) / Like (dating)
- Sheet CTAs still EntityBottomSheet defaults (C2b next)

## Next
- **C2b** dual-mode sheet CTAs (Like/Pass vs Wave/Message)
- **C3** OPEN_FULL → UserProfile with BACK to sheet
