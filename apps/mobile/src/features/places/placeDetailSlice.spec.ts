import type { NexaPlaceDetail, NexaSavedPlaceSummary } from '@g88/shared';

import reducer, {
  loadPlaceDetail,
  loadSavedPlaces,
  resolvePlaceMutationId,
  setPlaceSaved,
  type PlaceDetailsState,
} from './placeDetailSlice';

const placeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const aliasPlaceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
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

function aliasLoadedState(saved = false): PlaceDetailsState {
  return {
    entries: {
      [aliasPlaceId]: {
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

  it('hydrates the canonical cache when an alias resolves to canonical detail', () => {
    let state = reducer(undefined, loadPlaceDetail.pending('alias-load', { placeId: aliasPlaceId }));
    state = reducer(
      state,
      loadPlaceDetail.fulfilled(
        { detail, receivedAt: 20 },
        'alias-load',
        { placeId: aliasPlaceId },
      ),
    );

    expect(state.entries[aliasPlaceId]?.detail).toEqual(detail);
    expect(state.entries[aliasPlaceId]?.receivedAt).toBe(20);
    expect(state.entries[placeId]?.detail).toEqual(detail);
    expect(state.entries[placeId]?.receivedAt).toBe(20);
    expect(state.entries[aliasPlaceId]?.detail).not.toBe(state.entries[placeId]?.detail);
  });

  it('does not overwrite a newer canonical cache entry with an alias response', () => {
    const freshDetail: NexaPlaceDetail = { ...detail, canonicalLabel: 'Fresh canonical place' };
    const staleAliasDetail: NexaPlaceDetail = { ...detail, canonicalLabel: 'Stale alias label' };
    let state = loadedState(false);
    state.entries[placeId] = {
      ...state.entries[placeId]!,
      detail: freshDetail,
      receivedAt: 30,
    };
    state = reducer(state, loadPlaceDetail.pending('alias-stale', { placeId: aliasPlaceId }));
    state = reducer(
      state,
      loadPlaceDetail.fulfilled(
        { detail: staleAliasDetail, receivedAt: 20 },
        'alias-stale',
        { placeId: aliasPlaceId },
      ),
    );

    expect(state.entries[aliasPlaceId]?.detail).toEqual(staleAliasDetail);
    expect(state.entries[placeId]?.detail).toEqual(freshDetail);
    expect(state.entries[placeId]?.receivedAt).toBe(30);
  });

  it('joins a late alias entry to an in-flight canonical save lifecycle', () => {
    let state = reducer(undefined, setPlaceSaved.pending('save-live', { placeId, saved: true }));
    state = reducer(state, loadPlaceDetail.pending('alias-live', { placeId: aliasPlaceId }));
    state = reducer(
      state,
      loadPlaceDetail.fulfilled(
        { detail, receivedAt: 20 },
        'alias-live',
        { placeId: aliasPlaceId },
      ),
    );

    expect(state.entries[aliasPlaceId]).toMatchObject({
      detail,
      saveId: 'save-live',
    });
    expect(state.entries[placeId]).toMatchObject({
      detail: null,
      saveId: 'save-live',
    });

    state = reducer(
      state,
      setPlaceSaved.fulfilled({ placeId, saved: true }, 'save-live', { placeId, saved: true }),
    );

    expect(state.entries[aliasPlaceId]?.detail?.saved).toBe(true);
    expect(state.entries[aliasPlaceId]?.saveId).toBeNull();
    expect(state.entries[placeId]?.saveId).toBeNull();
  });

  it('resolves a loaded alias to its canonical place id for mutations', () => {
    const state = aliasLoadedState(false);

    expect(resolvePlaceMutationId(state, aliasPlaceId)).toBe(placeId);
    expect(resolvePlaceMutationId(state, 'unknown-place')).toBe('unknown-place');
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

  it('fans canonical save lifecycle out to an alias-keyed detail entry', () => {
    let state = reducer(
      aliasLoadedState(false),
      setPlaceSaved.pending('alias-save', { placeId: aliasPlaceId, saved: true }),
    );

    expect(state.entries[aliasPlaceId]?.saveId).toBe('alias-save');
    expect(state.entries[placeId]).toMatchObject({ detail: null, saveId: 'alias-save' });

    state = reducer(
      state,
      setPlaceSaved.fulfilled(
        { placeId, saved: true },
        'alias-save',
        { placeId: aliasPlaceId, saved: true },
      ),
    );

    expect(state.entries[aliasPlaceId]?.detail).toMatchObject({ id: placeId, saved: true });
    expect(state.entries[aliasPlaceId]?.saveId).toBeNull();
    expect(state.entries[placeId]?.saveId).toBeNull();
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

  it('clears alias and canonical mutation state when a canonical save request fails', () => {
    let state = reducer(
      aliasLoadedState(true),
      setPlaceSaved.pending('alias-fail', { placeId: aliasPlaceId, saved: false }),
    );

    state = reducer(
      state,
      setPlaceSaved.rejected(
        new Error('offline'),
        'alias-fail',
        { placeId: aliasPlaceId, saved: false },
        'Could not remove this saved place.',
      ),
    );

    expect(state.entries[aliasPlaceId]?.detail?.saved).toBe(true);
    expect(state.entries[aliasPlaceId]?.saveId).toBeNull();
    expect(state.entries[aliasPlaceId]?.saveError).toBe('Could not remove this saved place.');
    expect(state.entries[placeId]?.saveId).toBeNull();
    expect(state.entries[placeId]?.saveError).toBe('Could not remove this saved place.');
  });
});
