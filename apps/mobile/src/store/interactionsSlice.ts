import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Interaction, InteractionsResponse, ChatInteraction } from '@shared/types/interaction';
import { api } from '../api/client';

interface InteractionsState {
  items: Interaction[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const initialState: InteractionsState = {
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
};

export const fetchInteractions = createAsyncThunk(
  'interactions/fetch',
  async (cursor?: string | null) => {
    const params = cursor ? { cursor, limit: 30 } : { limit: 30 };
    const { data } = await api.get<InteractionsResponse>('/interactions', { params });
    return data;
  }
);

const interactionsSlice = createSlice({
  name: 'interactions',
  initialState,
  reducers: {
    upsertInteraction(state, action: PayloadAction<Interaction>) {
      const idx = state.items.findIndex((i) => i.id === action.payload.id);
      if (idx >= 0) {
        state.items[idx] = action.payload;
      } else {
        state.items.unshift(action.payload);
      }
      state.items.sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );
    },
    updateChatOnMessage(
      state,
      action: PayloadAction<{
        chatId: string;
        message: ChatInteraction['lastMessage'];
        unreadIncrement?: number;
      }>
    ) {
      const { chatId, message, unreadIncrement = 0 } = action.payload;
      const idx = state.items.findIndex(
        (i) => i.type === 'chat' && (i as ChatInteraction).chatId === chatId
      );
      if (idx >= 0) {
        const item = state.items[idx] as ChatInteraction;
        item.lastMessage = message;
        item.lastActivityAt = message.sentAt;
        item.unreadCount += unreadIncrement;
        item.isRead = item.unreadCount === 0;
        state.items.splice(idx, 1);
        state.items.unshift(item);
      }
    },
    markChatRead(state, action: PayloadAction<string>) {
      const item = state.items.find(
        (i) => i.type === 'chat' && (i as ChatInteraction).chatId === action.payload
      ) as ChatInteraction | undefined;
      if (item) {
        item.unreadCount = 0;
        item.isRead = true;
      }
    },
    setUserOnline(state, action: PayloadAction<{ userId: string; isOnline: boolean }>) {
      state.items.forEach((item) => {
        if (item.userId === action.payload.userId) {
          item.user.isOnline = action.payload.isOnline;
        }
      });
    },
    reset() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInteractions.pending, (state, action) => {
        if (action.meta.arg) state.loadingMore = true;
        else state.loading = true;
        state.error = null;
      })
      .addCase(fetchInteractions.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        if (action.meta.arg) {
          const existingIds = new Set(state.items.map((i) => i.id));
          const newItems = action.payload.items.filter((i) => !existingIds.has(i.id));
          state.items.push(...newItems);
        } else {
          state.items = action.payload.items;
        }
        state.nextCursor = action.payload.nextCursor;
      })
      .addCase(fetchInteractions.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.error.message ?? 'Failed to load interactions';
      });
  },
});

export const {
  upsertInteraction,
  updateChatOnMessage,
  markChatRead,
  setUserOnline,
  reset,
} = interactionsSlice.actions;

export default interactionsSlice.reducer;
