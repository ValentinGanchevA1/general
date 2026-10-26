import type { DiscoveryPoint, EntityPoint } from '@g88/shared';

import { replayDiscoveryMutations, type DiscoveryRealtimeMutation } from './discoveryMutationReplay';

function user(id: string, lat = 42.7): EntityPoint {
  return {
    kind: 'user',
    id,
    lat,
    lng: 23.3,
    meta: {
      displayName: 'User',
      avatarUrl: null,
      verification: 'none',
      online: false,
      lastSeenAt: null,
    },
  };
}

function event(id: string): EntityPoint {
  return {
    kind: 'event',
    id,
    lat: 42.7,
    lng: 23.3,
    meta: {
      title: 'Event',
      coverUrl: null,
      startsAt: '2026-10-26T12:00:00.000Z',
      attendeeCount: 0,
      capacity: null,
    },
  };
}

describe('replayDiscoveryMutations', () => {
  it('replays a newer socket update over a stale HTTP point', () => {
    const updated = user('u1', 42.71);
    const mutations: DiscoveryRealtimeMutation[] = [
      { sequence: 2, type: 'upsert', point: updated },
    ];

    expect(replayDiscoveryMutations([user('u1')], mutations, 1)).toEqual([updated]);
  });

  it('keeps a newer socket removal out of a stale HTTP snapshot', () => {
    const mutations: DiscoveryRealtimeMutation[] = [
      { sequence: 3, type: 'remove', key: 'user:u1' },
    ];

    expect(replayDiscoveryMutations([user('u1')], mutations, 2)).toEqual([]);
  });

  it('does not replay mutations that predate the request', () => {
    const httpPoint = user('u1', 42.72);
    const mutations: DiscoveryRealtimeMutation[] = [
      { sequence: 4, type: 'upsert', point: user('u1', 42.71) },
    ];

    expect(replayDiscoveryMutations([httpPoint], mutations, 4)).toEqual([httpPoint]);
  });

  it('keeps same raw id in different entity domains isolated', () => {
    const points: DiscoveryPoint[] = [user('shared'), event('shared')];
    const mutations: DiscoveryRealtimeMutation[] = [
      { sequence: 2, type: 'remove', key: 'user:shared' },
    ];

    expect(replayDiscoveryMutations(points, mutations, 1)).toEqual([event('shared')]);
  });
});
