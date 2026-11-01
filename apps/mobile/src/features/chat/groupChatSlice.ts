import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type {
  CreateGroupConversationRequest,
  CreateGroupConversationResponse,
  GroupConversationSummary,
} from '@g88/shared';

import { getJson, postJson } from '@/api/client';
import { logout } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface GroupChatState {
  groups: GroupConversationSummary[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  createError: string | null;
}

const initialState: GroupChatState = {
  groups: [],
  loading: false,
  error: null,
  creating: false,
  createError: null,
};

export const fetchGroupConversations = createAsyncThunk<
  GroupConversationSummary[],
  void,
  { rejectValue: string }
>('groupChat/fetchGroups', async (_, { rejectWithValue }) => {
  try {
    return await getJson<GroupConversationSummary[]>('/conversations/groups');
  } catch (error) {
    return rejectWithValue(extractMessage(error, 'Failed to load groups'));
  }
});

export const createGroupConversation = createAsyncThunk<
  CreateGroupConversationResponse,
  CreateGroupConversationRequest,
  { rejectValue: string }
>('groupChat/createGroup', async (request, { rejectWithValue }) => {
  try {
    return await postJson<CreateGroupConversationRequest, CreateGroupConversationResponse>(
      '/conversations/groups',
      request,
    );
  } catch (error) {
    return rejectWithValue(extractMessage(error, 'Could not create group'));
  }
});

const groupChatSlice = createSlice({
  name: 'groupChat',
  initialState,
  reducers: {
    clearGroupCreateError(state) {
      state.createError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGroupConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGroupConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.groups = action.payload;
      })
      .addCase(fetchGroupConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to load groups';
      })
      .addCase(createGroupConversation.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createGroupConversation.fulfilled, (state, action) => {
        state.creating = false;
        state.createError = null;
        const next = action.payload.conversation;
        state.groups = [next, ...state.groups.filter((group) => group.id !== next.id)];
      })
      .addCase(createGroupConversation.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload ?? 'Could not create group';
      })
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const { clearGroupCreateError } = groupChatSlice.actions;
export default groupChatSlice.reducer;
