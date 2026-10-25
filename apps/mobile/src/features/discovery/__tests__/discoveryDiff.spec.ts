import {
  applyDiscoveryDiff,
  getDiscoveryPointKey,
  type DiscoveryDiff,
  type DiscoveryPoint,
} from '@g88/shared';

const user = (id: string, displayName = id): DiscoveryPoint => ({
  kind: 'user',
  id,
  lat: 43.2,
  lng: 27.9,
  meta: {
    displayName,
    avatarUrl: null,
    verification: 'none',
    online: true,
    lastSeenAt: null,
  },
});

const event = (id: string): DiscoveryPoint => ({
  kind: 'event',
  id,
  lat: 43.21,
  lng: 27.91,
  meta: {
    title: id,
    coverUrl: null,
    startsAt: '2026-10-25T10:00:00.000Z',
    attendeeCount: 0,
    capacity: null,
  },
});

const cluster = (cellId: string): DiscoveryPoint => ({
  kind: 'cluster',
  cellId,
  lat: 43.22,
  lng: 27.92,
  count: 2,
  by: { user: 2 },
});

describe('discovery identity and diff application', () => {
  it('namespaces raw ids by entity kind', () => {
    expect(getDiscoveryPointKey(user('same-id'))).toBe('user:same-id');
    expect(getDiscoveryPointKey(event('same-id'))).toBe('event:same-id');
    expect(getDiscoveryPointKey(cluster('cell-1'))).toBe('cluster:cell-1');
  });

  it('preserves different entity kinds that share the same raw id', () => {
    const current = [user('same-id'), event('same-id')];
    const diff: DiscoveryDiff = {
      added: [user('same-id', 'Updated user')],
      removed: ['user:same-id'],
    };

    const next = applyDiscoveryDiff(current, diff);

    expect(next).toHaveLength(2);
    expect(next.map(getDiscoveryPointKey)).toEqual([
      'user:same-id',
      'event:same-id',
    ]);
    expect(next[0]?.kind === 'user' ? next[0].meta.displayName : null).toBe('Updated user');
  });

  it('accepts legacy raw removal keys during the staged rollout', () => {
    const current = [user('user-1'), cluster('cell-1')];
    const diff: DiscoveryDiff = {
      added: [],
      removed: ['cell-1'],
    };

    expect(applyDiscoveryDiff(current, diff).map(getDiscoveryPointKey)).toEqual([
      'user:user-1',
    ]);
  });

  it('deduplicates duplicate additions by canonical key', () => {
    const diff: DiscoveryDiff = {
      added: [user('user-1', 'Old'), user('user-1', 'Newest')],
      removed: [],
    };

    const next = applyDiscoveryDiff([], diff);

    expect(next).toHaveLength(1);
    expect(next[0]?.kind === 'user' ? next[0].meta.displayName : null).toBe('Newest');
  });
});
