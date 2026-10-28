import type { NexaSavedPlaceSummary } from '@g88/shared';

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

describe('savedPlaceMapFocusStore', () => {
  beforeEach(() => {
    savedPlaceMapFocusStore.clear();
  });

  it('stores only the coarse private place map point', () => {
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

  it('assigns a fresh request id even when focusing the same place twice', () => {
    savedPlaceMapFocusStore.request(PLACE);
    const firstId = savedPlaceMapFocusStore.getSnapshot()?.requestId;

    savedPlaceMapFocusStore.request(PLACE);
    const secondId = savedPlaceMapFocusStore.getSnapshot()?.requestId;

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);
  });

  it('clears the pending private focus request', () => {
    savedPlaceMapFocusStore.request(PLACE);
    savedPlaceMapFocusStore.clear();

    expect(savedPlaceMapFocusStore.getSnapshot()).toBeNull();
  });
});
