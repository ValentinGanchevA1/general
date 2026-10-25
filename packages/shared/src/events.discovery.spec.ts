import type {
  DiscoveryEntityLeaveEvent,
  DiscoveryEntityUpsertEvent,
  ServerToClientEvents,
} from './events';

const userPoint = {
  kind: 'user' as const,
  id: 'user-1',
  lat: 42.7,
  lng: 23.3,
  meta: {
    displayName: 'Nearby user',
    avatarUrl: null,
    verification: 'none' as const,
    online: true,
    lastSeenAt: null,
  },
};

describe('discovery realtime event contract', () => {
  it('carries the sanitized discovery entity shape for enter/update', () => {
    const payload: DiscoveryEntityUpsertEvent = { point: userPoint };
    const enter: ServerToClientEvents['discovery:entity:enter'] = (event) => {
      expect(event.point).toEqual(userPoint);
    };
    const update: ServerToClientEvents['discovery:entity:update'] = (event) => {
      expect(event.point.kind).toBe('user');
    };

    enter(payload);
    update(payload);
  });

  it('uses the canonical kind-aware key for leave', () => {
    const payload: DiscoveryEntityLeaveEvent = { key: 'user:user-1' };
    const leave: ServerToClientEvents['discovery:entity:leave'] = (event) => {
      expect(event.key).toBe('user:user-1');
    };

    leave(payload);
  });
});
