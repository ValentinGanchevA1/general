import type { NexaPlaceDetail, NexaSavedPlaceSummary } from '@g88/shared';

import reducer, {
  loadPlaceDetail,
  loadSavedPlaces,
  setPlaceSaved,
  type PlaceDetailsState,
} from './placeDetailSlice';

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
const savedItem: NexaSavedPlaceSummary = {
  id: placeId,
  canonicalLabel: 'Sea Garden',
  approximateLocation: { lat: 43.21, lng: 27.93 },
  locationPrecision: 'coarse',
  trending: true,
  recentActivityAt: '2026-10-28T04:00:00.000Z',
  savedAt: '2026-10-28T04:30:00.000Z',
};

function loadedState(saved = false): PlaceDetailsState {
  return {
    entries: {
      [placeId]: {
        detail: { ...detail, saved },
        loadId: null,
        saveId: null,
        error: null,
        saveError: null,
        receivedAt: 10,
      },
    },
    saved: {
      items: saved ? [savedItem] : [],
      loadId: null,
      error: null,
      nextOffset: null,
      receivedAt: 10,
    },
  };
}

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

  it('replaces the saved collection on authoritative refresh and ignores stale responses', () => {
    let state = reducer(undefined, loadSavedPlaces.pending('saved-new', { reset: true }));
    state = reducer(
      state,
      loadSavedPlaces.fulfilled(
        { page: { items: [], nextOffset: null }, reset: true, receivedAt: 10 },
        'saved-old',
        { reset: true },
      ),
    );
    expect(state.saved.loadId).toBe('saved-new');

    state = reducer(
      state,
      loadSavedPlaces.fulfilled(
        { page: { items: [savedItem], nextOffset: 30 }, reset: true, receivedAt: 20 },
        'saved-new',
        { reset: true },
      ),
    );
    expect(state.saved.items).toEqual([savedItem]);
    expect(state.saved.nextOffset).toBe(30);
    expect(state.saved.receivedAt).toBe(20);
  });

  it('appends saved pages without duplicating canonical place ids', () => {
    const other: NexaSavedPlaceSummary = { ...savedItem, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', canonicalLabel: 'Asparuhovo Beach' };
    let state = reducer(undefined, loadSavedPlaces.pending('first', { reset: true }));
    state = reducer(
      state,
      loadSavedPlaces.fulfilled(
        { page: { items: [savedItem], nextOffset: 30 }, reset: true, receivedAt: 10 },
        'first',
        { reset: true },
      ),
    );
    state = reducer(state, loadSavedPlaces.pending('more', {}));
    state = reducer(
      state,
      loadSavedPlaces.fulfilled(
        { page: { items: [savedItem, other], nextOffset: null }, reset: false, receivedAt: 20 },
        'more',
        {},
      ),
    );
    expect(state.saved.items.map((item) => item.id)).toEqual([placeId, other.id]);
  });

  it('tracks a save mutation without requiring loaded place detail', () => {
    let state = reducer(undefined, setPlaceSaved.pending('map-save', { placeId, saved: true }));

    expect(state.entries[placeId]).toMatchObject({
      detail: null,
      saveId: 'map-save',
      saveError: null,
    });

    state = reducer(
      state,
      setPlaceSaved.fulfilled({ placeId, saved: true }, 'map-save', { placeId, saved: true }),
    );

    expect(state.entries[placeId]).toMatchObject({
      detail: null,
      saveId: null,
      saveError: null,
    });
  });

  it('updates only the private saved flag after a successful mutation', () => {
    let state = reducer(loadedState(false), setPlaceSaved.pending('save-1', { placeId, saved: true }));
    state = reducer(
      state,
      setPlaceSaved.fulfilled({ placeId, saved: true }, 'save-1', { placeId, saved: true }),
    );

    expect(state.entries[placeId]?.detail).toMatchObject({ id: placeId, saved: true });
    expect(state.entries[placeId]?.saveId).toBeNull();
    expect(state.entries[placeId]?.saveError).toBeNull();
    expect(state.entries[placeId]?.error).toBeNull();
  });

  it('removes an unsaved canonical place from the private collection', () => {
    let state = reducer(loadedState(true), setPlaceSaved.pending('save-2', { placeId, saved: false }));
    state = reducer(
      state,
      setPlaceSaved.fulfilled({ placeId, saved: false }, 'save-2', { placeId, saved: false }),
    );
    expect(state.saved.items).toEqual([]);
    expect(state.entries[placeId]?.detail?.saved).toBe(false);
  });

  it('keeps the prior detail when a save mutation fails', () => {
    let state = reducer(loadedState(true), setPlaceSaved.pending('save-3', { placeId, saved: false }));
    state = reducer(
      state,
      setPlaceSaved.rejected(new Error('offline'), 'save-3', { placeId, saved: false }, 'Could not remove this saved place.'),
    );

    expect(state.entries[placeId]?.detail?.saved).toBe(true);
    expect(state.saved.items).toEqual([savedItem]);
    expect(state.entries[placeId]?.saveError).toBe('Could not remove this saved place.');
    expect(state.entries[placeId]?.error).toBe('Could not remove this saved place.');
  });
});
