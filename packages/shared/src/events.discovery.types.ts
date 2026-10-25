import type {
  DiscoveryEntityLeaveEvent,
  DiscoveryEntityUpsertEvent,
  ServerToClientEvents,
} from './events';

const upsert: DiscoveryEntityUpsertEvent = {
  point: {
    kind: 'user',
    id: 'fixture-user',
    lat: 42.7,
    lng: 23.3,
    meta: {
      displayName: 'Fixture',
      avatarUrl: null,
      verification: 'none',
      online: true,
      lastSeenAt: null,
    },
  },
};

const leave: DiscoveryEntityLeaveEvent = { key: 'user:fixture-user' };

export const discoveryRealtimeContractFixture: Pick<
  ServerToClientEvents,
  'discovery:entity:enter' | 'discovery:entity:update' | 'discovery:entity:leave'
> = {
  'discovery:entity:enter': (event) => void event.point,
  'discovery:entity:update': (event) => void event.point,
  'discovery:entity:leave': (event) => void event.key,
};

void upsert;
void leave;
