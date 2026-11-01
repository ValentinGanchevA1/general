import type {
  NexaPlaceDetail,
  NexaSavedPlaceSummary,
  PlaceMapEntityPoint,
} from '@g88/shared';

import { savedPlaceMapFocusStore } from './savedPlaceMapFocus.store';

const PLACE: NexaSavedPlaceSummary = {
  id: 'place-1',
  canonicalLabel: 'Sea Garden',
  approximateLocation: { lat: 43.207, lng: 27.927 },
  locationPrecision: 'coarse',
  trending: false,
  recentActivityAt: null,
  savedAt: '2026-10-28T08:00:00.000Z',
};

const DETAIL: NexaPlaceDetail = {
  id: 'place-2',
  canonicalLabel: 'Local Place',
  approximateLocation: { lat: 43.21, lng: 27.93 },
  locationPrecision: 'coarse',
  trending: true,
  recentActivityAt: '2026-10-28T09:00:00.000Z',
  saved: false,
};

const PUBLIC_POINT: PlaceMapEntityPoint = {
  kind: 'place',
  id: 'place-3',
  lat: 43.205,
  lng: 27.925,
  meta: {
    canonicalLabel: 'Active Place',
    trending: true,
    recentActivityAt: '2026-11-01T17:00:00.000Z',
    locationPrecision: 'coarse',
  },
};

describe('savedPlaceMapFocusStore', () => {
  beforeEach(() => {
    savedPlaceMapFocusStore.clear();
  });

  it('stores only the coarse private saved-place map point', () => {
    savedPlaceMapFocusStore.request(PLACE);

    expect(savedPlaceMapFocusStore.getSnapshot()).toEqual({
      requestId: expect.any(Number),
      point: {
        kind: 'place',
        id: 'place-1',
        lat: 43.207,
        lng: 27.927,
        meta: {
          canonicalLabel: 'Sea Garden',
          trending: false,
          recentActivityAt: null,
          locationPrecision: 'coarse',
          saved: true,
        },
      },
    });
  });

  it('stores a coarse Place Detail point without forcing saved state', () => {
    savedPlaceMapFocusStore.requestDetail(DETAIL);

    expect(savedPlaceMapFocusStore.getSnapshot()).toEqual({
      requestId: expect.any(Number),
      point: {
        kind: 'place',
        id: 'place-2',
        lat: 43.21,
        lng: 27.93,
        meta: {
          canonicalLabel: 'Local Place',
          trending: true,
          recentActivityAt: '2026-10-28T09:00:00.000Z',
          locationPrecision: 'coarse',
          saved: false,
        },
      },
    });
  });

  it('preserves a public Place point without fabricating private saved state', () => {
    savedPlaceMapFocusStore.requestPoint(PUBLIC_POINT);

    expect(savedPlaceMapFocusStore.getSnapshot()).toEqual({
      requestId: expect.any(Number),
      point: PUBLIC_POINT,
    });
    expect(savedPlaceMapFocusStore.getSnapshot()?.point.meta.saved).toBeUndefined();
  });

  it('assigns a fresh request id even when focusing the same place twice', () => {
    savedPlaceMapFocusStore.request(PLACE);
    const firstId = savedPlaceMapFocusStore.getSnapshot()?.requestId;

    savedPlaceMapFocusStore.request(PLACE);
    const secondId = savedPlaceMapFocusStore.getSnapshot()?.requestId;

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);
  });

  it('clears a focus request only when the canonical place id matches', () => {
    savedPlaceMapFocusStore.request(PLACE);
    savedPlaceMapFocusStore.clearIfMatches('place-1');

    expect(savedPlaceMapFocusStore.getSnapshot()).toBeNull();
  });

  it('preserves an unrelated focus request when another place is unsaved', () => {
    savedPlaceMapFocusStore.request(PLACE);
    const before = savedPlaceMapFocusStore.getSnapshot();

    savedPlaceMapFocusStore.clearIfMatches('place-2');

    expect(savedPlaceMapFocusStore.getSnapshot()).toBe(before);
  });

  it('clears the pending private focus request', () => {
    savedPlaceMapFocusStore.request(PLACE);
    savedPlaceMapFocusStore.clear();

    expect(savedPlaceMapFocusStore.getSnapshot()).toBeNull();
  });
});
