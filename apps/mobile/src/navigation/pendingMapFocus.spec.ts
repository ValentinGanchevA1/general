import {
  clearPendingMapFocus,
  peekPendingMapFocus,
  setPendingMapFocus,
  subscribePendingMapFocus,
} from './pendingMapFocus';

describe('pendingMapFocus', () => {
  afterEach(() => {
    clearPendingMapFocus();
  });

  it('notifies mounted map consumers when a user focus is set and cleared', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePendingMapFocus(listener);

    const token = setPendingMapFocus({
      userId: 'user-1',
      lat: 43.2,
      lng: 27.9,
      displayName: 'Valentin',
      avatarUrl: 'https://example.com/avatar.jpg',
      verification: 'id',
      online: true,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(peekPendingMapFocus()).toMatchObject({
      token,
      userId: 'user-1',
      lat: 43.2,
      lng: 27.9,
      displayName: 'Valentin',
    });

    clearPendingMapFocus(token);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(peekPendingMapFocus()).toBeNull();

    unsubscribe();
  });

  it('does not clear a newer focus request with a stale token', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePendingMapFocus(listener);

    const staleToken = setPendingMapFocus({userId: 'user-1', lat: 43.2, lng: 27.9});
    const currentToken = setPendingMapFocus({userId: 'user-2', lat: 43.21, lng: 27.91});
    listener.mockClear();

    clearPendingMapFocus(staleToken);

    expect(listener).not.toHaveBeenCalled();
    expect(peekPendingMapFocus()).toMatchObject({
      token: currentToken,
      userId: 'user-2',
    });

    unsubscribe();
  });
});
