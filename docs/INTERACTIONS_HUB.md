# Interactions Hub + Pulse Cleanup

**Branch:** `feature/interactions-hub-chats-pulse-cleanup`  
**Date:** 2026-08-29

## Goals
1. Move **Chats** into the **Interactions** screen (someone messaged you or you messaged them). Tap → open Chat screen.
2. Remove **Chat**, **Waves**, and **Matches** from **Pulse**.
3. **Trades** in Pulse stay tappable → open Trade / listing detail via existing `ActivityCard` deepLink.

## Shipped on this branch

### Pulse (`PulseScreen.tsx`)
- Filters reduced to: **All / Trades / Alerts**
- Feed client-filter also drops `chat` / `wave` / `match` activity types even if backend still returns them
- Empty copy updated

### Help (`HelpScreen.tsx`)
- FAQ for Pulse and Interactions updated to match the split

### Interactions
- Existing inbox (waves, friend requests, follows, story reactions) remains
- **Next step on this branch / follow-up:** merge `chatSlice.conversations` into the Interactions list UI with last-message preview + online indicator + navigate to `Chat`

### Scaffold (first commit — review / wire carefully)
Earlier commit added parallel scaffolding under:
- `packages/shared/types/interaction.ts` (prefer extending `@g88/shared` InboxItem instead)
- `apps/mobile/src/store/interactionsSlice.ts` (prefer existing `useInboxInteractions` + chatSlice)
- `apps/backend/src/interactions/*` (prefer existing `apps/backend/src/modules/interactions`)

**Do not double-register reducers.** Prefer extending the current InteractionsScreen + `/interactions/inbox` rather than the scaffold paths above unless you intentionally migrate.

## Remaining work
1. Extend `InteractionsScreen` row renderer for chat conversations (from `fetchConversations` / `chatSlice`).
2. Socket: on `chat:message`, refresh inbox or update conversation row in place.
3. Optional: backend include chats in `GET /interactions/inbox` for a single ordered list.
4. Clean up scaffold files if not used, or migrate fully to them in one PR.
5. Ensure `PulseFilter` type in navigator no longer requires removed keys (or map old deep links to `all`).
