import type { DiscoveryPoint } from '@g88/shared';

import {
  buildDiscoveryDiff,
  buildDiscoveryDiffFromSnapshot,
} from './discoveryDiff';

function user(id: string, lat = 42.7): DiscoveryPoint {
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

function event(id: string, lat = 42.7): DiscoveryPoint {
  return {
    kind: 'event',
    id,
    lat,
    lng: 23.3,
    meta: {
      title: 'Event',
      coverUrl: null,
      startsAt: '2026-10-25T12:00:00.000Z',
      attendeeCount: 0,
      capacity: null,
    },
  };
}

describe('buildDiscoveryDiff', () => {
  it('keeps same raw id in different entity domains isolated', () => {
    const previous = [user('shared'), event('shared')];
    const current = [event('shared')];

    expect(buildDiscoveryDiff(previous, current, 1)).toEqual({
      added: [],
      removed: ['user:shared'],
    });
  });

  it('uses canonical keys when a point changes', () => {
    const previous = [user('u1')];
    const changed = user('u1', 42.71);

    expect(buildDiscoveryDiff(previous, [changed])).toEqual({
      added: [changed],
      removed: ['user:u1'],
    });
  });

  it('ignores rankScore-only changes', () => {
    const previous = [{ ...user('u1'), rankScore: 0.1 }];
    const current = [{ ...user('u1'), rankScore: 0.9 }];

    expect(buildDiscoveryDiff(previous, current)).toEqual({
      added: [],
      removed: [],
    });
  });

  it('falls back to a full response when pure removals exceed threshold', () => {
    const previous = [user('u1'), user('u2'), user('u3')];
    const current = [user('u1')];

    expect(buildDiscoveryDiff(previous, current)).toBeNull();
  });
});

describe('buildDiscoveryDiffFromSnapshot', () => {
  it('preserves canonical cross-domain identity from a cached snapshot', () => {
    const previous = [user('shared'), event('shared')];

    expect(
      buildDiscoveryDiffFromSnapshot(
        JSON.stringify(previous),
        [event('shared')],
        1,
      ),
    ).toEqual({
      added: [],
      removed: ['user:shared'],
    });
  });

  it('falls back when the cached snapshot is malformed JSON', () => {
    expect(buildDiscoveryDiffFromSnapshot('{broken', [user('u1')])).toBeNull();
  });

  it('falls back when the cached snapshot is not an array', () => {
    expect(
      buildDiscoveryDiffFromSnapshot(JSON.stringify({ points: [user('u1')] }), [user('u1')]),
    ).toBeNull();
  });
});
