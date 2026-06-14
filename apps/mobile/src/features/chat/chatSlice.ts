import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ConversationSummary, ChatMessage, MessagePage } from '@g88/shared';

import { getJson } from '@/api/client';
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
  /** Keyed by conversationId. Messages ordered newest-first. */
  messages: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  nextCursor: Record<string, string | null>;
  /** Messages queued for send — drained when socket reconnects. */
  outbox: OutboxEntry[];
  /** Optimistic IDs that exhausted retries and show a permanent error. */
  failedIds: string[];
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
      if (idx !== -1) {
        // The server fans `chat:message` to the whole convo room — including the
        // sender — so the broadcast can beat the ack and `messageReceived` may have
        // already inserted the confirmed message. Overwriting the optimistic slot
        // would then duplicate that id (React "two children with the same key").
        // If the confirmed id is already present, drop the optimistic entry instead.
        const alreadyPresent = list.some(
          (m, i) => i !== idx && m.id === action.payload.confirmed.id,
        );
        if (alreadyPresent) {
          list.splice(idx, 1);
        } else {
          list[idx] = action.payload.confirmed;
        }
      }
      // Remove from outbox and failedIds if present.
      state.outbox = state.outbox.filter((e) => e.optimisticId !== action.payload.optimisticId);
      state.failedIds = state.failedIds.filter((id) => id !== action.payload.optimisticId);
    },

    /** Queue a message for retry when the socket is not connected. */
    messageQueued(state, action: PayloadAction<OutboxEntry>) {
      const existing = state.outbox.find((e) => e.optimisticId === action.payload.optimisticId);
      if (!existing) {
        state.outbox.push(action.payload);
      }
    },

    /** Increment retry count on an outbox entry after a failed drain attempt. */
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

    /** Remove a message from failedIds so the user can retry it manually. */
    failedMessageCleared(state, action: PayloadAction<string>) {
      state.failedIds = state.failedIds.filter((id) => id !== action.payload);
      // Re-queue with reset retries so the next send attempt works.
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
} = chatSlice.actions;

export { MAX_RETRIES };
export default chatSlice.reducer;
