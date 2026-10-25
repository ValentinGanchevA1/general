import type { DiscoveryPoint } from '@g88/shared';

import {
  discoveryPointToMapFeature,
  discoveryToMapFeatureCollection,
} from '../adapters/discoveryToGeoJson';

describe('discoveryToMapFeatureCollection', () => {
  const points: DiscoveryPoint[] = [
    {
      kind: 'cluster',
      cellId: '891234',
      lat: 43.2141,
      lng: 27.9147,
      count: 12,
      by: { user: 8, event: 3, listing: 1 },
    },
    {
      kind: 'user',
      id: 'same-id',
      lat: 43.21,
      lng: 27.91,
      rankScore: 1,
      meta: {
        displayName: 'Hidden from renderer',
        avatarUrl: 'https://example.invalid/avatar.jpg',
        verification: 'selfie',
        online: true,
        lastSeenAt: null,
        verifiedBadge: false,
        isFriend: false,
      },
    },
    {
      kind: 'listing',
      id: 'same-id',
      lat: 43.22,
      lng: 27.92,
      rankScore: 0.8,
      meta: {
        title: 'Hidden from renderer',
        thumbnailUrl: null,
        priceCents: 1200,
        currency: 'BGN',
        category: 'other',
        mode: 'sell',
        sellerId: 'seller-1',
        sellerDisplayName: 'Seller',
        createdAt: '2026-10-25T00:00:00.000Z',
        expiresAt: null,
        bumpedAt: null,
      },
    },
  ];

  it('uses canonical feature ids and GeoJSON longitude/latitude order', () => {
    const collection = discoveryToMapFeatureCollection(points);

    expect(collection.features.map((feature) => feature.id)).toEqual([
      'cluster:891234',
      'user:same-id',
      'listing:same-id',
    ]);
    expect(collection.features[1]?.geometry.coordinates).toEqual([27.91, 43.21]);
  });

  it('projects only renderer-safe allowlisted properties', () => {
    const feature = discoveryPointToMapFeature(points[1]!);
    const serialized = JSON.stringify(feature);

    expect(feature.properties.online).toBe(true);
    expect(feature.properties.verification).toBe('selfie');
    expect(serialized).not.toContain('Hidden from renderer');
    expect(serialized).not.toContain('avatar.jpg');
    expect(serialized).not.toContain('lastSeenAt');
  });

  it('keeps cluster counts without leaking cluster composition', () => {
    const feature = discoveryPointToMapFeature(points[0]!);
    const serialized = JSON.stringify(feature);

    expect(feature.properties.count).toBe(12);
    expect(serialized).not.toContain('"by"');
  });
});
