import type { DiscoveryPoint } from '@g88/shared';

import {
  MAPLIBRE_SPIKE_TARGET,
  buildMapLibreDiscoveryFrame,
  canEnableMapLibreRenderer,
} from '../mapLibreSpike';

const points: DiscoveryPoint[] = [
  {
    kind: 'user',
    id: 'shared-id',
    lat: 43.2141,
    lng: 27.9147,
    meta: {
      displayName: 'Private name',
      avatarUrl: 'https://example.invalid/private.jpg',
      verification: 'email',
      online: true,
      lastSeenAt: '2026-10-25T00:00:00.000Z',
    },
  },
];

describe('MapLibre spike contract', () => {
  it('targets the validated v11 renderer capabilities', () => {
    expect(MAPLIBRE_SPIKE_TARGET).toMatchObject({
      version: '11.5.0',
      requiresNewArchitecture: true,
      serverAuthoritativeClustering: true,
      clientClustering: false,
      featureStateSelection: true,
    });
  });

  it('reuses the privacy-minimal canonical GeoJSON projection', () => {
    const frame = buildMapLibreDiscoveryFrame(points, 'user:shared-id');
    const feature = frame.geoJson.features[0];

    expect(feature?.id).toBe('user:shared-id');
    expect(feature?.geometry.coordinates).toEqual([27.9147, 43.2141]);
    expect(feature?.properties).not.toHaveProperty('displayName');
    expect(feature?.properties).not.toHaveProperty('avatarUrl');
    expect(feature?.properties).not.toHaveProperty('lastSeenAt');
    expect(frame.selectedFeatureId).toBe('user:shared-id');
  });

  it('fails closed until every renderer parity gate is proven', () => {
    expect(
      canEnableMapLibreRenderer({
        baseMapReady: true,
        cameraParity: true,
        viewportParity: true,
        discoveryParity: true,
        selectionParity: false,
      }),
    ).toBe(false);

    expect(
      canEnableMapLibreRenderer({
        baseMapReady: true,
        cameraParity: true,
        viewportParity: true,
        discoveryParity: true,
        selectionParity: true,
      }),
    ).toBe(true);
  });
});
