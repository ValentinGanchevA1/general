/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports --
   jest.mock factories are hoisted above imports, so the navigation mock must
   pull React via sync require() rather than a top-level import. */
// apps/mobile/src/features/gamification/__tests__/useChallenges.spec.tsx
//
// Regression coverage for the stale daily-challenge banner: the map's
// DailyChallengeCard lives in the never-unmounting MapScreen, so a mount-only
// fetch froze its progress. useChallenges must refetch on the 'progress' event
// (wave sent / alert posted) and on screen focus.

import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useChallenges } from '../useChallenges';
import { challengeEvents } from '../challengeEvents';

const mockGetJson = jest.fn();

jest.mock('@/api/client', () => ({
  getJson: (path: string) => mockGetJson(path),
}));

// Real useFocusEffect runs the callback inside an effect on focus (not during
// render). Mirror that with useEffect so a stable callback fires once on mount —
// calling it during render would loop (refresh sets state → re-render → repeat).
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    __esModule: true,
    useFocusEffect: (cb: () => void) => React.useEffect(() => { cb(); }, [cb]),
  };
});

beforeEach(() => {
  mockGetJson.mockReset();
  mockGetJson.mockResolvedValue([]);
});

describe('useChallenges', () => {
  it('fetches /challenges/today on mount', async () => {
    renderHook(() => useChallenges());
    await waitFor(() => expect(mockGetJson).toHaveBeenCalledWith('/challenges/today'));
  });

  it('refetches when a challenge "progress" event fires', async () => {
    renderHook(() => useChallenges());
    await waitFor(() => expect(mockGetJson).toHaveBeenCalled());
    const before = mockGetJson.mock.calls.length;

    act(() => challengeEvents.emit('progress'));

    await waitFor(() => expect(mockGetJson.mock.calls.length).toBeGreaterThan(before));
  });

  it('stops refetching after unmount (listener cleaned up)', async () => {
    const { unmount } = renderHook(() => useChallenges());
    await waitFor(() => expect(mockGetJson).toHaveBeenCalled());
    unmount();
    const after = mockGetJson.mock.calls.length;

    act(() => challengeEvents.emit('progress'));

    expect(mockGetJson.mock.calls.length).toBe(after);
  });
});

describe('challengeEvents', () => {
  it('delivers to subscribers and unsubscribes cleanly', () => {
    const fn = jest.fn();
    const off = challengeEvents.on('progress', fn);
    challengeEvents.emit('progress');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    challengeEvents.emit('progress');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
