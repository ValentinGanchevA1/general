# Apply B/C — machine-owned sheet CTAs + match→chat

Branch: `feat/pin-machine-owned-ctas-match-chat`

## Already committed on branch
- `pinInteraction.types.ts` — conversationId / datingConversationId
- `pinInteraction.machine.ts` — assign ids on wave/like + MATCH_CREATED
- `usePinInteraction.ts` — sendWave/sendLike/sendPass + flags + isDetail pending
- `MAP_PIN_INTERACTION.md`

## Local (required) — wire sheet + MapScreen

Full files in project artifacts (agent):
- `EntityBottomSheet.b.tsx`
- `MapScreen.b.tsx`

```bash
git fetch origin
git checkout feat/pin-machine-owned-ctas-match-chat

# copy full files from agent artifacts OR apply logic:
# EntityBottomSheet: onLike/onPass/likeSent/isMatch/actionPending props;
#   UserCard handleLike/handlePass prefer callbacks over local POST
# MapScreen: pinSendWave/Like/Pass; match→Chat alert; machine toast/error

cp /path/to/EntityBottomSheet.b.tsx apps/mobile/src/components/map/EntityBottomSheet.tsx
cp /path/to/MapScreen.b.tsx apps/mobile/src/screens/MapScreen.tsx

pnpm --filter @g88/mobile typecheck
git add apps/mobile/src/components/map/EntityBottomSheet.tsx apps/mobile/src/screens/MapScreen.tsx
git commit -m "feat(map): machine-owned sheet CTAs + match→chat wire"
git push -u origin HEAD
```

## Acceptance
- [ ] Sheet Wave → SEND_WAVE only (no double POST)
- [ ] Sheet Like/Pass → machine; Pass dismisses sheet
- [ ] Match alert → Message opens Chat with datingConversationId
- [ ] Mutual wave alert → Chat when conversationId present
