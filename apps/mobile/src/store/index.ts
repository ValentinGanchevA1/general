import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import profileReducer from '@/features/profile/profileSlice';
import chatReducer, { outboxHydrated } from '@/features/chat/chatSlice';
import pulseReducer from '@/features/pulse/pulseSlice';
import discoveryReducer from '@/features/discovery/discoverySlice';
import idVerificationReducer from '@/features/verification/idVerificationSlice';
import storiesReducer from '@/features/stories/storiesSlice';
import friendsReducer from '@/features/friends/friendsSlice';
import mapNoveltyReducer from '@/features/map/mapNoveltySlice';
import {
  collectPendingMessages,
  loadChatOutbox,
  saveChatOutbox,
} from '@/features/chat/chatOutboxPersist';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    chat: chatReducer,
    pulse: pulseReducer,
    discovery: discoveryReducer,
    idVerification: idVerificationReducer,
    stories: storiesReducer,
    friends: friendsReducer,
    mapNovelty: mapNoveltyReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// ─── Chat outbox persistence (P2.C6) ─────────────────────────────────────────

void (async () => {
  const persisted = await loadChatOutbox();
  store.dispatch(
    outboxHydrated(
      persisted ?? { outbox: [], failedIds: [], pendingMessages: [] },
    ),
  );
})();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = '';

store.subscribe(() => {
  const { outbox, failedIds, messages, outboxHydrated: ready } = store.getState().chat;
  if (!ready) return;

  const pendingMessages = collectPendingMessages(messages, outbox, failedIds);
  const payload = { outbox, failedIds, pendingMessages };
  const serialized = JSON.stringify(payload);
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;

  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void saveChatOutbox(payload);
  }, 150);
});
