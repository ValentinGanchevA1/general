import { renderHook, waitFor } from '@testing-library/react-native';
import type { Viewport } from '@g88/shared';

import { usePlaceMapDiscovery } from './usePlaceMapDiscovery';

const mockPostJson = jest.fn();
const mockTryAcquire = jest.fn();
const mockDispatch = jest.fn();

jest.mock('@/api/client', () => ({
  postJson: (...args: unknown[]) => mockPostJson(...args),
}));

jest.mock('@/hooks/redux', () => ({
  useAppDispatch: () => mockDispatch,
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/features/discovery/discoveryRequestBudget', () => ({
  DiscoveryRequestBudget: jest.fn().mockImplementation(() => ({
    tryAcquire: (nowMs: number) => mockTryAcquire(nowMs),
  })),
}));

jest.mock('@/features/map/mapDiscoveryRank.store', () => ({
  mapDiscoveryRankStore: {
    subscribe: () => () => undefined,
    getSnapshot: () => 'relevance',
  },
}));

jest.mock('@/features/map/mapNoveltySlice', () => ({
  clearPlaceMapNewCount: () => ({ type: 'test/clearPlaceCount' }),
  setPlaceMapNewCount: (count: number) => ({ type: 'test/placeCount', payload: count }),
}));

jest.mock('./publicPlaceNovelty', () => ({
  loadSeenPublicPlaceKeys: async () => new Set<string>(),
  countUnseenPublicPlaces: () => ({ count: 0, keys: [] }),
  mergeSeenPublicPlaceKeys: (keys: Set<string>) => keys,
  saveSeenPublicPlaceKeys: async () => undefined,
}));

jest.mock('./publicPlaceTrending.store', () => ({
  publicPlaceTrendingStore: { clear: jest.fn(), setFromDiscovery: jest.fn() },
}));

const VIEWPORT_A: Viewport = {
  sw: { lat: 42, lng: 27 },
  ne: { lat: 43, lng: 28 },
};
const VIEWPORT_B: Viewport = {
  sw: { lat: 42.1, lng: 27.1 },
  ne: { lat: 43.1, lng: 28.1 },
};

describe('usePlaceMapDiscovery request-budget recovery', () => {
  beforeEach(() => {
    mockPostJson.mockReset();
    mockTryAcquire.mockReset();
    mockDispatch.mockReset();
  });

  it('replaces a previous failed viewport banner with queued refresh state', async () => {
    mockTryAcquire.mockReturnValueOnce(0).mockReturnValueOnce(30_000);
    mockPostJson.mockRejectedValue(new Error('A previous request failed'));

    const { result, rerender, unmount } = renderHook(
      ({ viewport }: { viewport: Viewport }) => usePlaceMapDiscovery({
        viewport,
        zoom: 12,
        enabled: true,
        debounceMs: 1,
      }),
      { initialProps: { viewport: VIEWPORT_A } },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(mockPostJson).toHaveBeenCalledTimes(1);

    rerender({ viewport: VIEWPORT_B });

    await waitFor(() => expect(mockTryAcquire).toHaveBeenCalledTimes(2));

    // The next request is queued but has not been sent. Its loading state
    // supersedes the previous viewport's now-stale failure banner.
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockPostJson).toHaveBeenCalledTimes(1);

    unmount();
  });
});
