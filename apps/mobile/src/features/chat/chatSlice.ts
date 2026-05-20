import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ConversationSummary, ChatMessage, MessagePage } from '@g88/shared';

import { getJson } from '@/api/client';
import { logout } from '@/features/auth/authSlice';

interface ChatState {
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  /** Keyed by conversationId. Messages ordered newest-first. */
  messages: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  nextCursor: Record<string, string | null>;
}

const initialState: ChatState = {
  conversations: [],
  conversationsLoading: false,
  messages: {},
  messagesLoading: {},
  nextCursor: {},
};

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      return await getJson<ConversationSummary[]>('/conversations');
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load conversations');
    }
  },
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (
    { conversationId, cursor }: { conversationId: string; cursor?: string },
    { rejectWithValue },
  ) => {
    try {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const page = await getJson<MessagePage>(`/conversations/${conversationId}/messages${qs}`);
      return { conversationId, page };
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load messages');
    }
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    /** Called when a chat:message socket event arrives. */
    messageReceived(state, action: PayloadAction<ChatMessage>) {
      const { conversationId } = action.payload;
      const existing = state.messages[conversationId] ?? [];
      if (!existing.some((m) => m.id === action.payload.id)) {
        state.messages[conversationId] = [action.payload, ...existing];
      }
      // Bubble up to conversation list preview.
      const convo = state.conversations.find((c) => c.id === conversationId);
      if (convo) {
        convo.lastMessage = { senderId: action.payload.senderId, body: action.payload.body };
        convo.lastMessageAt = action.payload.createdAt;
      }
    },
    /** Prepend an optimistically-sent message before the ack arrives. */
    messageSentOptimistic(state, action: PayloadAction<ChatMessage>) {
      const { conversationId } = action.payload;
      const existing = state.messages[conversationId] ?? [];
      if (!existing.some((m) => m.id === action.payload.id)) {
        state.messages[conversationId] = [action.payload, ...existing];
      }
    },
    /** Replace the optimistic message with the server-confirmed version. */
    messageConfirmed(
      state,
      action: PayloadAction<{ optimisticId: string; confirmed: ChatMessage }>,
    ) {
      const { conversationId } = action.payload.confirmed;
      const list = state.messages[conversationId];
      if (!list) return;
      const idx = list.findIndex((m) => m.id === action.payload.optimisticId);
      if (idx !== -1) list[idx] = action.payload.confirmed;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => { state.conversationsLoading = true; })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state) => { state.conversationsLoading = false; })

      .addCase(fetchMessages.pending, (state, action) => {
        state.messagesLoading[action.meta.arg.conversationId] = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, page } = action.payload;
        state.messagesLoading[conversationId] = false;
        const existing = state.messages[conversationId] ?? [];
        const seen = new Set(existing.map((m) => m.id));
        state.messages[conversationId] = [
          ...existing,
          ...page.messages.filter((m) => !seen.has(m.id)),
        ];
        state.nextCursor[conversationId] = page.nextCursor;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.messagesLoading[action.meta.arg.conversationId] = false;
      })

      .addCase(logout, () => initialState);
  },
});

export const { messageReceived, messageSentOptimistic, messageConfirmed } = chatSlice.actions;
export default chatSlice.reducer;
