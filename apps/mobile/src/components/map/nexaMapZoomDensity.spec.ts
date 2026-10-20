import type { ClusterPoint, DiscoveryPoint, EntityPoint } from '@g88/shared';

import {
  initialDiscoveryZoom,
  limitVisibleMapPoints,
  rawZoomForLatitudeDelta,
  resolveNexaMapZoomPolicy,
  stabilizeDiscoveryZoom,
} from './nexaMapZoomDensity';

function user(id: string): EntityPoint {
  return {
    kind: 'user',
    id,
    lat: 42,
    lng: 27,
    meta: {
      displayName: id,
      avatarUrl: null,
      verification: 'none',
      online: false,
      lastSeenAt: null,
    },
  };
}

function cluster(cellId: string): ClusterPoint {
  return {
    kind: 'cluster',
    cellId,
    lat: 42,
    lng: 27,
    count: 10,
    by: { user: 10 },
  };
}

describe('NEXA map zoom density', () => {
  it('derives continuous zoom from latitude delta', () => {
    expect(rawZoomForLatitudeDelta(360 / 2 ** 15)).toBeCloseTo(15, 5);
    expect(initialDiscoveryZoom(15.99)).toBe(15);
  });

  it('holds zoom around an upward boundary until hysteresis is crossed', () => {
    expect(stabilizeDiscoveryZoom(14, 15.05)).toBe(14);
    expect(stabilizeDiscoveryZoom(14, 15.19)).toBe(15);
  });

  it('holds zoom around a downward boundary until hysteresis is crossed', () => {
    expect(stabilizeDiscoveryZoom(15, 14.9)).toBe(15);
    expect(stabilizeDiscoveryZoom(15, 14.8)).toBe(14);
  });

  it('does not crawl through intermediate zooms after a large pinch', () => {
    expect(stabilizeDiscoveryZoom(10, 16.2)).toBe(16);
    expect(stabilizeDiscoveryZoom(17, 12.8)).toBe(12);
  });

  it('maps discovery zooms to progressive visual policies', () => {
    expect(resolveNexaMapZoomPolicy(8).band).toBe('overview');
    expect(resolveNexaMapZoomPolicy(11).band).toBe('city');
    expect(resolveNexaMapZoomPolicy(14).band).toBe('neighborhood');
    expect(resolveNexaMapZoomPolicy(15)).toMatchObject({
      band: 'local',
      markerDensity: 'compact',
      captionMode: 'selected',
    });
    expect(resolveNexaMapZoomPolicy(16)).toMatchObject({
      band: 'nearby',
      markerDensity: 'standard',
      captionMode: 'selected',
    });
    expect(resolveNexaMapZoomPolicy(17)).toMatchObject({
      band: 'detail',
      captionMode: 'all',
    });
  });

  it('caps points while preserving the selected entity', () => {
    const points: DiscoveryPoint[] = [
      user('1'),
      user('2'),
      user('3'),
      user('4'),
      user('5'),
    ];

    const result = limitVisibleMapPoints(points, 3, {
      selectedEntityKey: 'user:5',
    });

    expect(result).toHaveLength(3);
    expect(result.some((point) => point.kind === 'user' && point.id === '5')).toBe(true);
  });

  it('preserves selected clusters and own entities when density-capped', () => {
    const points: DiscoveryPoint[] = [
      cluster('a'),
      user('1'),
      user('2'),
      cluster('selected'),
      user('mine'),
    ];

    const result = limitVisibleMapPoints(points, 3, {
      selectedClusterCellId: 'selected',
      ownEntityKey: 'user:mine',
    });

    expect(result.some((point) => point.kind === 'cluster' && point.cellId === 'selected')).toBe(true);
    expect(result.some((point) => point.kind === 'user' && point.id === 'mine')).toBe(true);
  });
});
