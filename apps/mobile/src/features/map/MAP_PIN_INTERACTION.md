# Pin interaction (Stage 1)

## Files
- `pinInteraction.types.ts` — context + events
- `pinInteraction.machine.ts` — XState v5 machine (mocked API actors)
- `usePinInteraction.ts` — React hook for MapScreen
- `PreviewCallout` + `PinInteractionHost` — Stage-1 UI

## MapScreen wiring
1. `viewerMode = datingOnly ? 'dating' : 'social'`
2. User pin press → `openUserPin(point)` → machine `PIN_TAP` → preview
3. Event / listing pin press → existing EntityBottomSheet path (unchanged)
4. Preview **Open** → `openDetail()` + present EntityBottomSheet for that user
5. `datingOnly` toggle → `LAYER_CHANGED` → machine idle + hide preview

## Install
```bash
pnpm install --filter @g88/mobile
```

## Next
- Replace mocked actors with real POST /waves and POST /dating/likes
- Socket: `wave:mutual`, `match:created` → `send({ type: ... })`
- Stage 2/3: drive EntityBottomSheet from machine `detailSheet` / `fullProfile`
