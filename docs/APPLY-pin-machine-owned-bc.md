# Apply B/C — machine-owned sheet CTAs + match→chat

Branch: `feat/pin-machine-owned-ctas-match-chat`

## Already on branch (OK)
- `pinInteraction.types.ts` — conversationId / datingConversationId
- `pinInteraction.machine.ts` — assign ids on wave/like + MATCH_CREATED
- `usePinInteraction.ts` — sendWave/sendLike/sendPass + flags + isDetail pending
- `MAP_PIN_INTERACTION.md`

## CRITICAL — restore + wire sheet/MapScreen

Branch currently has placeholder/stub for EntityBottomSheet + MapScreen. Overwrite from agent artifacts:

```bash
git fetch origin
git checkout feat/pin-machine-owned-ctas-match-chat

cp /path/to/artifacts/EntityBottomSheet.b.tsx apps/mobile/src/components/map/EntityBottomSheet.tsx
cp /path/to/artifacts/MapScreen.b.tsx apps/mobile/src/screens/MapScreen.tsx

# Checksums (sha256 first 16):
# EntityBottomSheet.b.tsx  cd7d346770aa54dc  (24369 bytes)
# MapScreen.b.tsx          92fe1ff7f739a76e  (27786 bytes)

pnpm --filter @g88/mobile typecheck
git add apps/mobile/src/components/map/EntityBottomSheet.tsx apps/mobile/src/screens/MapScreen.tsx
git commit -m "feat(map): machine-owned sheet CTAs + match→chat wire (B/C)"
git push -u origin HEAD
```

## What the B/C files do
- EntityBottomSheet: `onLike`/`onPass`/`likeSent`/`isMatch`/`actionPending`; handleLike/handlePass prefer machine callbacks
- MapScreen: pinSendWave/Like/Pass; match→Chat alert; machine toast/error

## Acceptance
- [ ] Sheet Wave → SEND_WAVE only (no double POST)
- [ ] Sheet Like/Pass → machine; Pass dismisses sheet
- [ ] Match alert → Message opens Chat with datingConversationId
- [ ] Mutual wave alert → Chat when conversationId present
