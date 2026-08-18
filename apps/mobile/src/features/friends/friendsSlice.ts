import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  FriendCard,
  FriendPendingCount,
  FriendRequestCard,
  FriendRequestsPage,
  FriendsPage,
} from '@g88/shared';

import { deleteJson, getJson, postJson } from '@/api/client';
import { extractMessage } from '@/utils/extractMessage';

export type FriendsTab = 'friends' | 'following' | 'followers' | 'requests';

interface ListState<T> {
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

interface FriendsState {
  friends: ListState<FriendCard>;
  following: ListState<FriendCard>;
  followers: ListState<FriendCard>;
  requests: ListState<FriendRequestCard>;
  /** Incoming pending friend-request count (badge). */
  pendingCount: number;
  /** In-flight accept/decline/unfriend ids for row spinners. */
  pendingActionIds: string[];
}

function emptyList<T>(): ListState<T> {
  return { items: [], nextCursor: null, loading: false, loadingMore: false, error: null };
}

const initialState: FriendsState = {
  friends: emptyList(),
  following: emptyList(),
  followers: emptyList(),
  requests: emptyList(),
  pendingCount: 0,
  pendingActionIds: [],
};

function pathForTab(tab: Exclude<FriendsTab, 'requests'>): string {
  if (tab === 'friends') return '/friends';
  if (tab === 'following') return '/friends/following';
  return '/friends/followers';
}

export const fetchFriendsTab = createAsyncThunk(
  'friends/fetchTab',
  async (
    args: { tab: FriendsTab; cursor?: string },
    { rejectWithValue },
  ) => {
    try {
      const qs = args.cursor ? `?cursor=${encodeURIComponent(args.cursor)}` : '';
      if (args.tab === 'requests') {
        const page = await getJson<FriendRequestsPage>(`/friends/requests/pending${qs}`);
        return { tab: args.tab, page, append: Boolean(args.cursor) } as const;
      }
      const page = await getJson<FriendsPage>(`${pathForTab(args.tab)}${qs}`);
      return { tab: args.tab, page, append: Boolean(args.cursor) } as const;
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Failed to load'));
    }
  },
);

export const fetchPendingCount = createAsyncThunk(
  'friends/fetchPendingCount',
  async (_, { rejectWithValue }) => {
    try {
      return await getJson<FriendPendingCount>('/friends/requests/pending/count');
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Failed to load pending count'));
    }
  },
);

export const acceptFriendRequest = createAsyncThunk(
  'friends/accept',
  async (requestId: string, { rejectWithValue }) => {
    try {
      await postJson<Record<string, never>, { friends: true }>(
        `/friends/requests/${requestId}/accept`,
        {},
      );
      return requestId;
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Could not accept request'));
    }
  },
);

export const declineFriendRequest = createAsyncThunk(
  'friends/decline',
  async (requestId: string, { rejectWithValue }) => {
    try {
      await postJson<Record<string, never>, { declined: true }>(
        `/friends/requests/${requestId}/decline`,
        {},
      );
      return requestId;
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Could not decline request'));
    }
  },
);

export const unfriendUser = createAsyncThunk(
  'friends/unfriend',
  async (userId: string, { rejectWithValue }) => {
    try {
      await deleteJson<{ friends: false }>(`/friends/${userId}`);
      return userId;
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Could not unfriend'));
    }
  },
);

const friendsSlice = createSlice({
  name: 'friends',
  initialState,
  reducers: {
    /** Live update from `friend:presence` WS (close-friends tab only). */
    friendOnlineChanged(
      state,
      action: PayloadAction<{ userId: string; online: boolean }>,
    ) {
      const { userId, online } = action.payload;
      const row = state.friends.items.find((f) => f.userId === userId);
      if (row) row.online = online;
    },
    /** Live badge from `friend:request` WS. */
    pendingCountSet(state, action: PayloadAction<number>) {
      state.pendingCount = Math.max(0, action.payload);
    },
    pendingCountDelta(state, action: PayloadAction<number>) {
      state.pendingCount = Math.max(0, state.pendingCount + action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFriendsTab.pending, (state, action) => {
        const tab = action.meta.arg.tab;
        const list = state[tab];
        if (action.meta.arg.cursor) {
          list.loadingMore = true;
        } else {
          list.loading = true;
          list.error = null;
        }
      })
      .addCase(fetchFriendsTab.fulfilled, (state, action) => {
        const { tab, page, append } = action.payload;
        const list = state[tab];
        list.loading = false;
        list.loadingMore = false;
        list.error = null;
        list.nextCursor = page.nextCursor;
        if (tab === 'requests') {
          const items = (page as FriendRequestsPage).items;
          state.requests.items = append ? [...state.requests.items, ...items] : items;
          // Badge must stay on total pending (GET /count or WS), not page length.
        } else {
          const items = (page as FriendsPage).items;
          const target = state[tab];
          target.items = append ? [...target.items, ...items] : items;
        }
      })
      .addCase(fetchFriendsTab.rejected, (state, action) => {
        const tab = action.meta.arg.tab;
        const list = state[tab];
        list.loading = false;
        list.loadingMore = false;
        list.error = (action.payload as string) ?? 'Failed to load';
      })
      .addCase(fetchPendingCount.fulfilled, (state, action) => {
        state.pendingCount = action.payload.count;
      })
      .addCase(acceptFriendRequest.pending, (state, action) => {
        state.pendingActionIds.push(action.meta.arg);
      })
      .addCase(acceptFriendRequest.fulfilled, (state, action) => {
        state.pendingActionIds = state.pendingActionIds.filter((id) => id !== action.payload);
        state.requests.items = state.requests.items.filter((r) => r.id !== action.payload);
        state.pendingCount = Math.max(0, state.pendingCount - 1);
      })
      .addCase(acceptFriendRequest.rejected, (state, action) => {
        state.pendingActionIds = state.pendingActionIds.filter((id) => id !== action.meta.arg);
      })
      .addCase(declineFriendRequest.pending, (state, action) => {
        state.pendingActionIds.push(action.meta.arg);
      })
      .addCase(declineFriendRequest.fulfilled, (state, action) => {
        state.pendingActionIds = state.pendingActionIds.filter((id) => id !== action.payload);
        state.requests.items = state.requests.items.filter((r) => r.id !== action.payload);
        state.pendingCount = Math.max(0, state.pendingCount - 1);
      })
      .addCase(declineFriendRequest.rejected, (state, action) => {
        state.pendingActionIds = state.pendingActionIds.filter((id) => id !== action.meta.arg);
      })
      .addCase(unfriendUser.pending, (state, action) => {
        state.pendingActionIds.push(action.meta.arg);
      })
      .addCase(unfriendUser.fulfilled, (state, action) => {
        state.pendingActionIds = state.pendingActionIds.filter((id) => id !== action.payload);
        state.friends.items = state.friends.items.filter((f) => f.userId !== action.payload);
      })
      .addCase(unfriendUser.rejected, (state, action) => {
        state.pendingActionIds = state.pendingActionIds.filter((id) => id !== action.meta.arg);
      });
  },
});

export const { friendOnlineChanged, pendingCountSet, pendingCountDelta } = friendsSlice.actions;
export default friendsSlice.reducer;
