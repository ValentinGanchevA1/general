import type { MapDiscoveryPoint } from '@g88/shared';

import {
  countUnseenPublicPlaces,
  mergeSeenPublicPlaceKeys,
  publicPlaceNoveltyPoints,
} from './publicPlaceNovelty';

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

describe('publicPlaceNovelty', () => {
  it('keeps only public coarse Place entity pins from the public discovery lane', () => {
    expect(publicPlaceNoveltyPoints([CLUSTER, PUBLIC_PLACE])).toEqual([PUBLIC_PLACE]);
  });

  it('never turns cluster totals into novelty counts', () => {
    expect(countUnseenPublicPlaces([CLUSTER], new Set())).toEqual({ count: 0, keys: [] });
  });

  it('counts each unseen public Place by canonical NEXA id', () => {
    const second: MapDiscoveryPoint = { ...PUBLIC_PLACE, id: 'place-2' };

    expect(countUnseenPublicPlaces(
      [PUBLIC_PLACE, second],
      new Set(['place:place-1']),
    )).toEqual({ count: 1, keys: ['place:place-2'] });
  });

  it('merges seen keys without mutating the previous set', () => {
    const previous = new Set(['place:place-1']);
    const next = mergeSeenPublicPlaceKeys(previous, ['place:place-2']);

    expect(previous).toEqual(new Set(['place:place-1']));
    expect(next).toEqual(new Set(['place:place-1', 'place:place-2']));
  });
});
