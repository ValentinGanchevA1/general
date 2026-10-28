import eventReviewsReducer from '@/features/events/eventReviewsSlice';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import passwordResetReducer from '@/features/auth/passwordResetSlice';
import profileReducer from '@/features/profile/profileSlice';
import chatReducer, { outboxHydrated } from '@/features/chat/chatSlice';
import pulseReducer from '@/features/pulse/pulseSlice';
import discoveryReducer from '@/features/discovery/discoverySlice';
import idVerificationReducer from '@/features/verification/idVerificationSlice';
import storiesReducer from '@/features/stories/storiesSlice';
import friendsReducer from '@/features/friends/friendsSlice';
import mapNoveltyReducer from '@/features/map/mapNoveltySlice';
import mapRendererPolicyReducer from '@/features/map/mapRendererPolicySlice';
import placesReducer from '@/features/places/placeDetailSlice';
import { savedPlaceMapFocusStore } from '@/features/places/savedPlaceMapFocus.store';
import {
  savedPlacesMapLayerStore,
  shouldResetSavedPlacesMapLayer,
} from '@/features/places/savedPlacesMapLayer.store';
import {
  collectPendingMessages,
  loadChatOutbox,
  saveChatOutbox,
} from '@/features/chat/chatOutboxPersist';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    eventReviews: eventReviewsReducer,
    passwordReset: passwordResetReducer,
    profile: profileReducer,
    chat: chatReducer,
    pulse: pulseReducer,
    discovery: discoveryReducer,
    idVerification: idVerificationReducer,
    stories: storiesReducer,
    friends: friendsReducer,
    mapNovelty: mapNoveltyReducer,
    mapRendererPolicy: mapRendererPolicyReducer,
    places: placesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// ─── Session-scoped private map state ────────────────────────────────────────

let previousAuthUserId = store.getState().auth.user?.id ?? null;
store.subscribe(() => {
  const nextAuthUserId = store.getState().auth.user?.id ?? null;
  if (shouldResetSavedPlacesMapLayer(previousAuthUserId, nextAuthUserId)) {
    savedPlacesMapLayerStore.reset();
    savedPlaceMapFocusStore.clear();
  }
  previousAuthUserId = nextAuthUserId;
});

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
