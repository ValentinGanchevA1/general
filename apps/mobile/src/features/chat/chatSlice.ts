import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ConversationSummary, ChatMessage, MessagePage } from '@g88/shared';

import { getJson, postJson } from '@/api/client';
import { logout } from '@/features/auth/authSlice';

export interface OutboxEntry {
  optimisticId: string;
  conversationId: string;
  body: string;
  retries: number;
}

interface ChatState {
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  messages: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  nextCursor: Record<string, string | null>;
  outbox: OutboxEntry[];
  failedIds: string[];
  activeConversationId: string | null;
}

const MAX_RETRIES = 3;

const initialState: ChatState = {
  conversations: [],
  conversationsLoading: false,
  messages: {},
  messagesLoading: {},
  nextCursor: {},
  outbox: [],
  failedIds: [],
  activeConversationId: null,
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

export const markConversationReadRemote = createAsyncThunk(
  'chat/markConversationReadRemote',
  async (conversationId: string, { rejectWithValue }) => {
    try {
      await postJson(`/conversations/${conversationId}/read`, {});
      return conversationId;
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to mark read');
    }
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
      if (action.payload) {
        const convo = state.conversations.find((c) => c.id === action.payload);
        if (convo) convo.unreadCount = 0;
      }
    },

    messageReceived(
      state,
      action: PayloadAction<ChatMessage & { viewerId?: string }>,
    ) {
      const { conversationId, senderId, body, createdAt, viewerId } = action.payload;
      const existing = state.messages[conversationId] ?? [];
      if (!existing.some((m) => m.id === action.payload.id)) {
        state.messages[conversationId] = [action.payload, ...existing];
      }
      const convo = state.conversations.find((c) => c.id === conversationId);
      if (convo) {
        convo.lastMessage = { senderId, body };
        convo.lastMessageAt = createdAt;
        const isActive = state.activeConversationId === conversationId;
        if (!isActive && viewerId && senderId !== viewerId) {
          convo.unreadCount = (convo.unreadCount ?? 0) + 1;
        }
      }
    },

    conversationMarkedRead(state, action: PayloadAction<string>) {
      const convo = state.conversations.find((c) => c.id === action.payload);
      if (convo) {
        convo.unreadCount = 0;
      }
    },

    messageSentOptimistic(state, action: PayloadAction<ChatMessage>) {
      const { conversationId } = action.payload;
      const existing = state.messages[conversationId] ?? [];
      if (!existing.some((m) => m.id === action.payload.id)) {
        state.messages[conversationId] = [action.payload, ...existing];
      }
    },

    messageConfirmed(
      state,
      action: PayloadAction<{ optimisticId: string; confirmed: ChatMessage }>,
    ) {
      const { conversationId } = action.payload.confirmed;
      const list = state.messages[conversationId];
      if (!list) return;
      const idx = list.findIndex((m) => m.id === action.payload.optimisticId);
      if (idx !== -1) {
        const alreadyPresent = list.some(
          (m, i) => i !== idx && m.id === action.payload.confirmed.id,
        );
        if (alreadyPresent) {
          list.splice(idx, 1);
        } else {
          list[idx] = action.payload.confirmed;
        }
      }
      state.outbox = state.outbox.filter((e) => e.optimisticId !== action.payload.optimisticId);
      state.failedIds = state.failedIds.filter((id) => id !== action.payload.optimisticId);
    },

    messageQueued(state, action: PayloadAction<OutboxEntry>) {
      const existing = state.outbox.find((e) => e.optimisticId === action.payload.optimisticId);
      if (!existing) {
        state.outbox.push(action.payload);
      }
    },

    outboxRetryIncremented(state, action: PayloadAction<string>) {
      const entry = state.outbox.find((e) => e.optimisticId === action.payload);
      if (!entry) return;
      entry.retries += 1;
      if (entry.retries >= MAX_RETRIES) {
        state.outbox = state.outbox.filter((e) => e.optimisticId !== action.payload);
        if (!state.failedIds.includes(action.payload)) {
          state.failedIds.push(action.payload);
        }
      }
    },

    failedMessageCleared(state, action: PayloadAction<string>) {
      state.failedIds = state.failedIds.filter((id) => id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state) => {
        state.conversationsLoading = false;
      })
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
        if (!action.meta.arg.cursor) {
          const convo = state.conversations.find((c) => c.id === conversationId);
          if (convo) convo.unreadCount = 0;
        }
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.messagesLoading[action.meta.arg.conversationId] = false;
      })
      .addCase(markConversationReadRemote.fulfilled, (state, action) => {
        const convo = state.conversations.find((c) => c.id === action.payload);
        if (convo) convo.unreadCount = 0;
      })
      .addCase(logout.fulfilled, () => initialState);
  },
});

export const {
  messageReceived,
  messageSentOptimistic,
  messageConfirmed,
  messageQueued,
  outboxRetryIncremented,
  failedMessageCleared,
  conversationMarkedRead,
  setActiveConversation,
} = chatSlice.actions;

export { MAX_RETRIES };
export default chatSlice.reducer;
