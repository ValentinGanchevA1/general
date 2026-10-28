import type { NexaSavedPlaceSummary, Viewport } from '@g88/shared';

import { savedPlacesToMapPoints } from './useSavedPlacesMapOverlay';

const viewport: Viewport = {
  sw: { lat: 43, lng: 27 },
  ne: { lat: 44, lng: 28 },
};

function savedPlace(id: string, lat: number, lng: number, trending = false): NexaSavedPlaceSummary {
  return {
    id,
    canonicalLabel: `Place ${id}`,
    approximateLocation: { lat, lng },
    locationPrecision: 'coarse',
    trending,
    recentActivityAt: trending ? '2026-10-28T05:00:00.000Z' : null,
    savedAt: '2026-10-28T04:00:00.000Z',
  };
}

describe('savedPlacesToMapPoints', () => {
  it('creates viewer-private coarse place pins only inside the viewport', () => {
    expect(savedPlacesToMapPoints([
      savedPlace('inside', 43.2, 27.9),
      savedPlace('outside', 45, 27.9),
    ], viewport)).toEqual([
      {
        kind: 'place',
        id: 'inside',
        lat: 43.2,
        lng: 27.9,
        meta: {
          canonicalLabel: 'Place inside',
          trending: false,
          recentActivityAt: null,
          locationPrecision: 'coarse',
          saved: true,
        },
      },
    ]);
  });

  it('preserves thresholded trend state without turning inactive bookmarks live', () => {
    const [point] = savedPlacesToMapPoints([savedPlace('active', 43.2, 27.9, true)], viewport);
    expect(point?.meta).toMatchObject({ saved: true, trending: true });
    expect(point?.meta.recentActivityAt).toBe('2026-10-28T05:00:00.000Z');
  });

  it('supports viewports crossing the antimeridian', () => {
    const crossing: Viewport = {
      sw: { lat: -10, lng: 170 },
      ne: { lat: 10, lng: -170 },
    };
    const ids = savedPlacesToMapPoints([
      savedPlace('east', 0, 175),
      savedPlace('west', 0, -175),
      savedPlace('middle', 0, 0),
    ], crossing).map((point) => point.id);
    expect(ids).toEqual(['east', 'west']);
  });
});
