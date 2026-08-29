# Interactions Hub + Pulse Cleanup

**Branch:** `feature/interactions-hub-chats-pulse-cleanup`  
**Date:** 2026-08-29

## Goals
1. Move **Chats** into the **Interactions** screen (someone messaged you or you messaged them). Tap → open Chat screen.
2. Remove **Chat**, **Waves**, and **Matches** from **Pulse**.
3. Make **Trades** in Pulse tappable → open Trade detail screen.

## Decisions
- Interactions = single people-activity hub (waves + follows + matches + chats)
- Pulse = alerts + marketplace (+ later dating swipe)
- Chat row: last message preview + unread badge + timestamp + online indicator
- Sort: most recent activity first; unread chats have visual badge
- Real-time: new messages appear instantly via Socket.IO
- Hide blocked & deleted; show unmatched; Match button stays next to waves
- Pagination: basic load-more for now; sort toggles later

## Files added
- `packages/shared/types/interaction.ts` – shared types
- `apps/mobile/src/store/interactionsSlice.ts`
- `apps/mobile/src/hooks/useInteractionsRealtime.ts`
- `apps/mobile/src/screens/InteractionsScreen.tsx`
- `apps/mobile/src/components/interactions/InteractionRow.tsx`
- `apps/backend/src/interactions/interactions.controller.ts`
- `apps/backend/src/interactions/interactions.service.ts`

## Integration steps remaining
1. Register `interactions` reducer in the root store.
2. Wire navigation: Interactions route already exists; ensure Chat / Profile / MatchFlow params match.
3. Implement `InteractionsService.getInteractions` (merge chats + waves + follows + matches, exclude blocked/deleted).
4. Emit `interaction:new` and `chat:message` from existing gateways.
5. In PulseScreen:
   - Remove any Chat / Wave / Match list items or sections.
   - Wrap Trade rows with `onPress={() => navigation.navigate('TradeDetail', { tradeId })}`.
6. Update HelpScreen copy if needed (Pulse description).

## Socket events
- `interaction:new` → Interaction payload
- `chat:message` → `{ chatId, message, isFromMe }`
- `user:online` / `user:offline` → `{ userId, isOnline? }`
