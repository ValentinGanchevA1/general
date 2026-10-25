import type { DiscoveryEntityUpsertEvent } from '@g88/shared';

import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import type { RealtimeGateway } from './realtime.gateway';

describe('DiscoveryRealtimePublisher', () => {
  it('targets the authenticated viewer room instead of a shared cell room', () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const realtime = {
      server: { to },
    } as unknown as RealtimeGateway;
    const publisher = new DiscoveryRealtimePublisher(realtime);
    const event: DiscoveryEntityUpsertEvent = {
      point: {
        kind: 'user',
        id: 'nearby-user',
        lat: 42.7,
        lng: 23.3,
        meta: {
          displayName: 'Nearby user',
          avatarUrl: null,
          verification: 'none',
          online: true,
          lastSeenAt: null,
        },
      },
    };

    publisher.emitEnter('viewer-1', event);

    expect(to).toHaveBeenCalledWith('user:viewer-1');
    expect(to).not.toHaveBeenCalledWith(expect.stringMatching(/^cell:/));
    expect(emit).toHaveBeenCalledWith('discovery:entity:enter', event);
  });

  it('emits canonical leave keys to the viewer room', () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const realtime = {
      server: { to },
    } as unknown as RealtimeGateway;
    const publisher = new DiscoveryRealtimePublisher(realtime);

    publisher.emitLeave('viewer-2', { key: 'listing:listing-1' });

    expect(to).toHaveBeenCalledWith('user:viewer-2');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', {
      key: 'listing:listing-1',
    });
  });
});
