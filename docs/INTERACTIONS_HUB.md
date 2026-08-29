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
- Unified list: `chatSlice.conversations` + inbox (waves, friend requests, follows, story reactions)
- Sort by most recent activity (`lastMessageAt` / `createdAt`)
- **ChatRow**: peer name, last-message preview, peer online dot, pending badge, **green unread badge**
- Tap chat → `Chat` with `conversationId`, `otherUserId`, `otherUserName`, `requestPending`
- `fetchConversations` on focus; refresh on `chat:message` socket

### Unread counts
- Backend `findConversations`: MVP `unreadCount = 1` when latest message is from peer, else `0`
- `chatSlice.messageReceived`: increments when `viewerId` known and sender ≠ viewer
- `fetchConversations.fulfilled`: keeps `Math.max(server, local)` so socket increments are not clobbered
- `fetchMessages` (first page) and `conversationMarkedRead` clear unread
- ChatRow shows badge `1`…`99+` and bold name/preview when unread

### Scaffold cleanup (done)
Removed unused first-commit files (not wired into production paths):
- `packages/shared/types/interaction.ts`
- `apps/mobile/src/store/interactionsSlice.ts`
- `apps/mobile/src/hooks/useInteractionsRealtime.ts`
- `apps/mobile/src/components/interactions/InteractionRow.tsx`
- `apps/backend/src/interactions/*` (prefer existing modules)

Production path remains: `useInboxInteractions` + `chatSlice` + `InteractionsScreen` HubRow/ChatRow/InboxRow.

## Optional follow-ups
1. Server-side `conversation_reads` / `last_read_at` for accurate multi-message unread counts
2. Optional: include chats in `GET /interactions/inbox` for a single ordered API list
3. Tab-level badge summing conversation unreadCounts
