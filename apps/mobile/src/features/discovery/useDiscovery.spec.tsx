import { renderHook, waitFor } from '@testing-library/react-native';
import type { Viewport } from '@g88/shared';

import { useDiscovery } from './useDiscovery';

const mockPostJson = jest.fn();
const mockTryAcquire = jest.fn();
const mockDispatch = jest.fn();

jest.mock('@/api/client', () => ({
  postJson: (...args: unknown[]) => mockPostJson(...args),
}));

jest.mock('@/hooks/redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => [],
}));

jest.mock('@/realtime/useSocket', () => ({
  useSocket: () => ({
    on: () => () => undefined,
    socket: null,
    connected: false,
  }),
}));

jest.mock('./discoveryRequestBudget', () => ({
  DiscoveryRequestBudget: jest.fn().mockImplementation(() => ({
    tryAcquire: (nowMs: number) => mockTryAcquire(nowMs),
  })),
}));

jest.mock('@/features/map/mapDiscoveryRank.store', () => ({
  mapDiscoveryRankStore: {
    subscribe: () => () => undefined,
    getSnapshot: () => 'relevance',
    set: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('@/features/map/marketplaceKindMapFilter.store', () => ({
  marketplaceKindMapFilterStore: {
    subscribe: () => () => undefined,
    getSnapshot: () => 'all',
  },
}));

const VIEWPORT_A: Viewport = {
  sw: { lat: 42, lng: 27 },
  ne: { lat: 43, lng: 28 },
};
const VIEWPORT_B: Viewport = {
  sw: { lat: 42.1, lng: 27.1 },
  ne: { lat: 43.1, lng: 28.1 },
};

describe('useDiscovery request-budget recovery', () => {
  beforeEach(() => {
    mockPostJson.mockReset();
    mockTryAcquire.mockReset();
    mockDispatch.mockReset();
  });

  it('clears a stale failure when the next viewport is waiting for request budget', async () => {
    mockTryAcquire.mockReturnValueOnce(0).mockReturnValueOnce(30_000);
    mockPostJson.mockRejectedValue(new Error('A previous nearby request failed'));

    const { result, rerender, unmount } = renderHook(
      ({ viewport }: { viewport: Viewport }) => useDiscovery({
        viewport,
        zoom: 12,
        debounceMs: 1,
      }),
      { initialProps: { viewport: VIEWPORT_A } },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(mockPostJson).toHaveBeenCalledTimes(1);

    rerender({ viewport: VIEWPORT_B });
    await waitFor(() => expect(mockTryAcquire).toHaveBeenCalledTimes(2));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockPostJson).toHaveBeenCalledTimes(1);

    unmount();
  });
});
