import type { NexaPlaceDetail } from '@g88/shared';

import reducer, { loadPlaceDetail, setPlaceSaved, type PlaceDetailsState } from './placeDetailSlice';

const placeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const detail: NexaPlaceDetail = {
  id: placeId,
  canonicalLabel: 'Sea Garden',
  approximateLocation: { lat: 43.21, lng: 27.93 },
  locationPrecision: 'coarse',
  trending: true,
  recentActivityAt: '2026-10-28T04:00:00.000Z',
  saved: false,
};

describe('placeDetailSlice', () => {
  it('stores canonical detail and ignores a stale load response', () => {
    let state = reducer(undefined, loadPlaceDetail.pending('req-new', { placeId }));
    state = reducer(
      state,
      loadPlaceDetail.fulfilled({ detail, receivedAt: 10 }, 'req-old', { placeId }),
    );
    expect(state.entries[placeId]?.detail).toBeNull();

    state = reducer(
      state,
      loadPlaceDetail.fulfilled({ detail, receivedAt: 20 }, 'req-new', { placeId }),
    );
    expect(state.entries[placeId]?.detail).toEqual(detail);
    expect(state.entries[placeId]?.receivedAt).toBe(20);
  });

  it('updates only the private saved flag after a successful mutation', () => {
    const loaded: PlaceDetailsState = {
      entries: {
        [placeId]: {
          detail: { ...detail },
          loadId: null,
          saveId: null,
          error: null,
          receivedAt: 10,
        },
      },
    };

    let state = reducer(loaded, setPlaceSaved.pending('save-1', { placeId, saved: true }));
    state = reducer(
      state,
      setPlaceSaved.fulfilled({ placeId, saved: true }, 'save-1', { placeId, saved: true }),
    );

    expect(state.entries[placeId]?.detail).toMatchObject({ id: placeId, saved: true });
    expect(state.entries[placeId]?.saveId).toBeNull();
    expect(state.entries[placeId]?.error).toBeNull();
  });

  it('keeps the prior detail when a save mutation fails', () => {
    const loaded: PlaceDetailsState = {
      entries: {
        [placeId]: {
          detail: { ...detail, saved: true },
          loadId: null,
          saveId: null,
          error: null,
          receivedAt: 10,
        },
      },
    };

    let state = reducer(loaded, setPlaceSaved.pending('save-2', { placeId, saved: false }));
    state = reducer(
      state,
      setPlaceSaved.rejected(new Error('offline'), 'save-2', { placeId, saved: false }, 'Could not remove this saved place.'),
    );

    expect(state.entries[placeId]?.detail?.saved).toBe(true);
    expect(state.entries[placeId]?.error).toBe('Could not remove this saved place.');
  });
});
