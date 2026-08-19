// apps/mobile/src/features/friends/friendsSlice.spec.ts
//
// Coverage for the friends slice: per-tab list state (loading/loadingMore/
// error/cursor append), pendingCount clamping (WS delta can't go negative),
// and the accept/decline/unfriend pendingActionIds lifecycle that drives the
// row-spinner + disabled-button guard in FriendsListScreen.

import type { FriendCard, FriendRequestCard, FriendsPage, FriendRequestsPage } from '@g88/shared';

const mockGetJson = jest.fn();
const mockPostJson = jest.fn();
const mockDeleteJson = jest.fn();

jest.mock('@/api/client', () => ({
  getJson: (path: string) => mockGetJson(path),
  postJson: (path: string, body: unknown) => mockPostJson(path, body),
  deleteJson: (path: string) => mockDeleteJson(path),
}));

import reducer, {
  fetchFriendsTab,
  fetchPendingCount,
  acceptFriendRequest,
  declineFriendRequest,
  unfriendUser,
  friendOnlineChanged,
  pendingCountSet,
  pendingCountDelta,
} from './friendsSlice';

function friendCard(userId: string): FriendCard {
  return { userId, displayName: userId, avatarUrl: null, online: false, createdAt: '2026-08-01T00:00:00Z' };
}

function requestCard(id: string): FriendRequestCard {
  return {
    id,
    fromUserId: `from-${id}`,
    displayName: id,
    avatarUrl: null,
    createdAt: '2026-08-01T00:00:00Z',
  };
}

beforeEach(() => {
  mockGetJson.mockReset();
  mockPostJson.mockReset();
  mockDeleteJson.mockReset();
});

describe('friendsSlice reducers', () => {
  it('friendOnlineChanged only updates a matching row in the friends list', () => {
    let state = reducer(undefined, { type: '@@init' });
    state = { ...state, friends: { ...state.friends, items: [friendCard('a'), friendCard('b')] } };

    state = reducer(state, friendOnlineChanged({ userId: 'b', online: true }));

    expect(state.friends.items.find((f) => f.userId === 'a')?.online).toBe(false);
    expect(state.friends.items.find((f) => f.userId === 'b')?.online).toBe(true);
  });

  it('friendOnlineChanged is a no-op when the user is not in the friends list', () => {
    const before = reducer(undefined, { type: '@@init' });
    const after = reducer(before, friendOnlineChanged({ userId: 'ghost', online: true }));
    expect(after.friends.items).toEqual(before.friends.items);
  });

  it('pendingCountSet clamps negative values to zero', () => {
    const state = reducer(undefined, pendingCountSet(-3));
    expect(state.pendingCount).toBe(0);
  });

  it('pendingCountDelta clamps at zero and does not go negative', () => {
    let state = reducer(undefined, pendingCountSet(1));
    state = reducer(state, pendingCountDelta(-5));
    expect(state.pendingCount).toBe(0);
  });

  it('pendingCountDelta accumulates positive deltas', () => {
    let state = reducer(undefined, pendingCountSet(2));
    state = reducer(state, pendingCountDelta(3));
    expect(state.pendingCount).toBe(5);
  });
});

describe('fetchFriendsTab', () => {
  it('sets loading (not loadingMore) on an initial fetch, and populates items on success', async () => {
    const page: FriendsPage = { items: [friendCard('a')], nextCursor: 'cursor-2' };
    mockGetJson.mockResolvedValueOnce(page);

    let state = reducer(undefined, { type: '@@init' });
    const pendingAction = { type: fetchFriendsTab.pending.type, meta: { arg: { tab: 'friends' as const } } };
    state = reducer(state, pendingAction);
    expect(state.friends.loading).toBe(true);
    expect(state.friends.loadingMore).toBe(false);

    const fulfilledAction = {
      type: fetchFriendsTab.fulfilled.type,
      meta: { arg: { tab: 'friends' as const } },
      payload: { tab: 'friends' as const, page, append: false },
    };
    state = reducer(state, fulfilledAction);

    expect(state.friends.loading).toBe(false);
    expect(state.friends.items).toEqual(page.items);
    expect(state.friends.nextCursor).toBe('cursor-2');
  });

  it('sets loadingMore (not loading) when a cursor is present, and appends on success', async () => {
    let state = reducer(undefined, { type: '@@init' });
    state = {
      ...state,
      following: { ...state.following, items: [friendCard('existing')] },
    };

    const pendingAction = {
      type: fetchFriendsTab.pending.type,
      meta: { arg: { tab: 'following' as const, cursor: 'c1' } },
    };
    state = reducer(state, pendingAction);
    expect(state.following.loading).toBe(false);
    expect(state.following.loadingMore).toBe(true);

    const page: FriendsPage = { items: [friendCard('new')], nextCursor: null };
    const fulfilledAction = {
      type: fetchFriendsTab.fulfilled.type,
      meta: { arg: { tab: 'following' as const, cursor: 'c1' } },
      payload: { tab: 'following' as const, page, append: true },
    };
    state = reducer(state, fulfilledAction);

    expect(state.following.loadingMore).toBe(false);
    expect(state.following.items.map((f) => f.userId)).toEqual(['existing', 'new']);
    expect(state.following.nextCursor).toBeNull();
  });

  it('replaces (does not append) the requests tab on a non-cursor fetch', async () => {
    let state = reducer(undefined, { type: '@@init' });
    state = { ...state, requests: { ...state.requests, items: [requestCard('stale')] } };

    const page: FriendRequestsPage = { items: [requestCard('r1')], nextCursor: null };
    const fulfilledAction = {
      type: fetchFriendsTab.fulfilled.type,
      meta: { arg: { tab: 'requests' as const } },
      payload: { tab: 'requests' as const, page, append: false },
    };
    state = reducer(state, fulfilledAction);

    expect(state.requests.items.map((r) => r.id)).toEqual(['r1']);
  });

  it('stores the error message and clears both loading flags on rejection', async () => {
    let state = reducer(undefined, { type: '@@init' });
    state = { ...state, friends: { ...state.friends, loading: true } };

    const rejectedAction = {
      type: fetchFriendsTab.rejected.type,
      meta: { arg: { tab: 'friends' as const } },
      payload: 'Network error',
    };
    state = reducer(state, rejectedAction);

    expect(state.friends.loading).toBe(false);
    expect(state.friends.loadingMore).toBe(false);
    expect(state.friends.error).toBe('Network error');
  });

  it('requests the pending-requests endpoint for the requests tab and the tab-specific path otherwise', async () => {
    mockGetJson.mockResolvedValue({ items: [], nextCursor: null });
    const dispatch = jest.fn();
    const getState = () => undefined;
    const extra = undefined;
    const thunk = fetchFriendsTab({ tab: 'requests' });
    await thunk(dispatch, getState, extra);
    expect(mockGetJson).toHaveBeenCalledWith('/friends/requests/pending');

    mockGetJson.mockClear();
    const thunk2 = fetchFriendsTab({ tab: 'followers', cursor: 'abc' });
    await thunk2(dispatch, getState, extra);
    expect(mockGetJson).toHaveBeenCalledWith('/friends/followers?cursor=abc');
  });
});

describe('fetchPendingCount', () => {
  it('sets pendingCount from the response on success', () => {
    let state = reducer(undefined, { type: '@@init' });
    const fulfilledAction = {
      type: fetchPendingCount.fulfilled.type,
      payload: { count: 7 },
    };
    state = reducer(state, fulfilledAction);
    expect(state.pendingCount).toBe(7);
  });
});

describe('accept / decline / unfriend — pendingActionIds lifecycle', () => {
  it('acceptFriendRequest: tracks the id while in flight, removes it and the row on success, decrements the badge', () => {
    let state = reducer(undefined, { type: '@@init' });
    state = { ...state, requests: { ...state.requests, items: [requestCard('r1')] }, pendingCount: 1 };

    state = reducer(state, { type: acceptFriendRequest.pending.type, meta: { arg: 'r1' } });
    expect(state.pendingActionIds).toContain('r1');

    state = reducer(state, { type: acceptFriendRequest.fulfilled.type, payload: 'r1' });
    expect(state.pendingActionIds).not.toContain('r1');
    expect(state.requests.items).toHaveLength(0);
    expect(state.pendingCount).toBe(0);
  });

  it('acceptFriendRequest: clears the in-flight id on failure without touching the badge or the row', () => {
    let state = reducer(undefined, { type: '@@init' });
    state = { ...state, requests: { ...state.requests, items: [requestCard('r1')] }, pendingCount: 1 };
    state = reducer(state, { type: acceptFriendRequest.pending.type, meta: { arg: 'r1' } });

    state = reducer(state, { type: acceptFriendRequest.rejected.type, meta: { arg: 'r1' } });

    expect(state.pendingActionIds).not.toContain('r1');
    expect(state.requests.items).toHaveLength(1);
    expect(state.pendingCount).toBe(1);
  });

  it('declineFriendRequest: removes the row and decrements the badge on success', () => {
    let state = reducer(undefined, { type: '@@init' });
    state = { ...state, requests: { ...state.requests, items: [requestCard('r2')] }, pendingCount: 2 };

    state = reducer(state, { type: declineFriendRequest.pending.type, meta: { arg: 'r2' } });
    state = reducer(state, { type: declineFriendRequest.fulfilled.type, payload: 'r2' });

    expect(state.requests.items).toHaveLength(0);
    expect(state.pendingCount).toBe(1);
  });

  it('unfriendUser: removes the row from the friends list on success (leaves the badge untouched)', () => {
    let state = reducer(undefined, { type: '@@init' });
    state = {
      ...state,
      friends: { ...state.friends, items: [friendCard('u1'), friendCard('u2')] },
      pendingCount: 3,
    };

    state = reducer(state, { type: unfriendUser.pending.type, meta: { arg: 'u1' } });
    state = reducer(state, { type: unfriendUser.fulfilled.type, payload: 'u1' });

    expect(state.friends.items.map((f) => f.userId)).toEqual(['u2']);
    expect(state.pendingCount).toBe(3);
  });

  it('does not let a rejected id leak into pendingActionIds forever (double-tap safe)', () => {
    let state = reducer(undefined, { type: '@@init' });
    state = reducer(state, { type: unfriendUser.pending.type, meta: { arg: 'dup' } });
    state = reducer(state, { type: unfriendUser.pending.type, meta: { arg: 'dup' } });
    expect(state.pendingActionIds.filter((id) => id === 'dup')).toHaveLength(2);

    state = reducer(state, { type: unfriendUser.rejected.type, meta: { arg: 'dup' } });
    expect(state.pendingActionIds).not.toContain('dup');
  });
});
