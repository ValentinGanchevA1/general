import type { ClusterPoint, MapDiscoveryPoint } from '@g88/shared';

import { mergeMapDiscoveryPoints } from './mergeMapDiscoveryPoints';

const baseCluster: ClusterPoint = {
  kind: 'cluster',
  cellId: '871e85992ffffff',
  lat: 43.2,
  lng: 27.9,
  count: 3,
  by: { user: 2, event: 1 },
};

const placeCluster: MapDiscoveryPoint = {
  kind: 'cluster',
  cellId: '871e85992ffffff',
  lat: 43.2,
  lng: 27.9,
  count: 2,
  by: { place: 2 },
};

const placePoint: MapDiscoveryPoint = {
  kind: 'place',
  id: 'place-1',
  lat: 43.2,
  lng: 27.9,
  meta: {
    canonicalLabel: 'Sea Garden',
    trending: true,
    recentActivityAt: '2026-10-28T03:00:00.000Z',
    locationPrecision: 'coarse',
  },
};

describe('mergeMapDiscoveryPoints', () => {
  it('merges cluster composition by H3 cell', () => {
    expect(mergeMapDiscoveryPoints([baseCluster], [placeCluster])).toEqual([
      expect.objectContaining({
        kind: 'cluster',
        cellId: baseCluster.cellId,
        count: 5,
        by: { user: 2, event: 1, place: 2 },
      }),
    ]);
  });

  it('keeps place entities as first-class entity points at entity zoom', () => {
    expect(mergeMapDiscoveryPoints([], [placePoint])).toEqual([placePoint]);
  });
});
