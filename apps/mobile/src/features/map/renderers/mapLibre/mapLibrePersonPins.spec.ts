import type { MapDiscoveryPoint } from '@g88/shared';

import { partitionMapLibreDiscoveryPoints } from './mapLibrePersonPins';

const points: MapDiscoveryPoint[] = [
  {
    kind: 'cluster',
    cellId: 'cell-1',
    lat: 43.2141,
    lng: 27.9147,
    count: 8,
    by: { user: 7, event: 1, listing: 0 },
  },
  {
    kind: 'user',
    id: 'user-1',
    lat: 43.21,
    lng: 27.91,
    rankScore: 1,
    meta: {
      displayName: 'Nearby person',
      avatarUrl: 'https://example.invalid/avatar.jpg',
      verification: 'id',
      online: true,
      lastSeenAt: null,
      verifiedBadge: true,
      isFriend: false,
    },
  },
  {
    kind: 'listing',
    id: 'listing-1',
    lat: 43.22,
    lng: 27.92,
    rankScore: 0.8,
    meta: {
      title: 'Nearby listing',
      thumbnailUrl: null,
      priceCents: 1200,
      currency: 'BGN',
      category: 'other',
      mode: 'sell',
      sellerId: 'seller-1',
      sellerDisplayName: 'Seller',
      createdAt: '2026-11-02T00:00:00.000Z',
      expiresAt: null,
      bumpedAt: null,
    },
  },
];

describe('partitionMapLibreDiscoveryPoints', () => {
  it('moves individual users out of the generic GeoJSON layer', () => {
    const result = partitionMapLibreDiscoveryPoints(points);

    expect(result.personPoints.map((point) => point.id)).toEqual(['user-1']);
    expect(result.layerPoints.map((point) => point.kind)).toEqual(['cluster', 'listing']);
    expect(result.layerPoints.some((point) => point.kind === 'user')).toBe(false);
  });

  it('keeps low-zoom clusters in the scalable GeoJSON layer', () => {
    const result = partitionMapLibreDiscoveryPoints([points[0]!]);

    expect(result.personPoints).toEqual([]);
    expect(result.layerPoints).toEqual([points[0]]);
  });
});
