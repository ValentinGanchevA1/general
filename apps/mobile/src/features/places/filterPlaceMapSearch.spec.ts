import type { MapClusterPoint, PlaceMapEntityPoint } from '@g88/shared';

import { filterPlaceMapSearch } from './filterPlaceMapSearch';

const CLUSTER: MapClusterPoint = {
  kind: 'cluster',
  cellId: 'cluster-1',
  lat: 43.21,
  lng: 27.92,
  count: 3,
  by: { place: 3 },
};

const SEA_GARDEN: PlaceMapEntityPoint = {
  kind: 'place',
  id: 'place-sea-garden',
  lat: 43.207,
  lng: 27.927,
  meta: {
    canonicalLabel: 'Sea Garden',
    trending: true,
    recentActivityAt: '2026-10-29T10:00:00.000Z',
    locationPrecision: 'coarse',
  },
};

const CATHEDRAL: PlaceMapEntityPoint = {
  kind: 'place',
  id: 'place-cathedral',
  lat: 43.205,
  lng: 27.91,
  meta: {
    canonicalLabel: 'Dormition Cathedral',
    trending: false,
    recentActivityAt: null,
    locationPrecision: 'coarse',
    saved: true,
  },
};

describe('filterPlaceMapSearch', () => {
  it('filters Place labels case-insensitively while retaining authoritative clusters', () => {
    const result = filterPlaceMapSearch(
      [CLUSTER, SEA_GARDEN, CATHEDRAL],
      ' sea ',
      new Set<string>(),
    );

    expect(result).toEqual([CLUSTER, SEA_GARDEN]);
  });

  it('preserves an actively selected or focused Place even when its label does not match', () => {
    const result = filterPlaceMapSearch(
      [SEA_GARDEN, CATHEDRAL],
      'sea',
      new Set([CATHEDRAL.id]),
    );

    expect(result).toEqual([SEA_GARDEN, CATHEDRAL]);
  });

  it('does not filter Place entities for an empty search', () => {
    const points = [CLUSTER, SEA_GARDEN, CATHEDRAL];

    expect(filterPlaceMapSearch(points, '   ', new Set<string>())).toEqual(points);
  });
});
