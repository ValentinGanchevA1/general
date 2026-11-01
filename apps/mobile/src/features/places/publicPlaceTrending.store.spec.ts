import type { MapDiscoveryPoint } from '@g88/shared';

import {
  publicPlaceTrendingCandidates,
  publicPlaceTrendingStore,
} from './publicPlaceTrending.store';

const PUBLIC_PLACE: MapDiscoveryPoint = {
  kind: 'place',
  id: 'place-1',
  lat: 43.207,
  lng: 27.927,
  meta: {
    canonicalLabel: 'Sea Garden',
    trending: true,
    recentActivityAt: '2026-11-01T17:00:00.000Z',
    locationPrecision: 'coarse',
  },
};

const CLUSTER: MapDiscoveryPoint = {
  kind: 'cluster',
  cellId: '871ec90c6ffffff',
  lat: 43.2,
  lng: 27.9,
  count: 6,
  by: { place: 6 },
};

describe('publicPlaceTrendingStore', () => {
  beforeEach(() => {
    publicPlaceTrendingStore.clear();
  });

  it('keeps only public thresholded Place entity points', () => {
    const candidates = publicPlaceTrendingCandidates([CLUSTER, PUBLIC_PLACE]);

    expect(candidates).toEqual([PUBLIC_PLACE]);
  });

  it('never publishes cluster counts as trending card candidates', () => {
    publicPlaceTrendingStore.setFromDiscovery([CLUSTER]);

    expect(publicPlaceTrendingStore.getSnapshot()).toEqual([]);
  });

  it('publishes and clears the current public Place entity lane', () => {
    publicPlaceTrendingStore.setFromDiscovery([PUBLIC_PLACE]);
    expect(publicPlaceTrendingStore.getSnapshot()).toEqual([PUBLIC_PLACE]);

    publicPlaceTrendingStore.clear();
    expect(publicPlaceTrendingStore.getSnapshot()).toEqual([]);
  });

  it('bounds the UI mirror independently from map response size', () => {
    const points: MapDiscoveryPoint[] = Array.from({ length: 12 }, (_, index) => ({
      ...PUBLIC_PLACE,
      id: `place-${index}`,
    }));

    expect(publicPlaceTrendingCandidates(points)).toHaveLength(8);
  });
});
