# Apply: pinInteraction.machine.spec.ts + STATUS_CURRENT

```bash
git fetch origin
git checkout -B feat/pin-machine-spec-status origin/master

cp /path/to/artifacts/pinInteraction.machine.spec.ts \
   apps/mobile/src/features/map/pinInteraction.machine.spec.ts

pnpm --filter @g88/mobile exec jest src/features/map/pinInteraction.machine.spec.ts --ci

git add apps/mobile/src/features/map/pinInteraction.machine.spec.ts docs/STATUS_CURRENT.md
git commit -m "test(map): pinInteraction machine specs + STATUS_CURRENT sync (B/C)"
git push -u origin HEAD
```

## Spec coverage
- idle → PIN_TAP → preview
- load error + RETRY
- OPEN_DETAIL / OPEN_FULL / BACK
- social wave non-mutual + mutual (conversationId)
- WAVE_MUTUAL from waveSent
- dating like matched + MATCH_CREATED (datingConversationId)
- PASS → idle
- LAYER_CHANGED / DISMISS reset
- PIN_TAP switches pin
- canLike blocked when peerMode social-only
