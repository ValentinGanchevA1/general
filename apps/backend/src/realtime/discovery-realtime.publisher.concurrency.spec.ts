import type { DiscoveryPoint } from '@g88/shared';

import type { DiscoveryEntityResolver } from '../modules/discovery/discovery-entity-resolver.service';
import type { DiscoveryMutationBusService } from './discovery-mutation-bus.service';
import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import type { RealtimeEmitterService } from './realtime-emitter.service';
import type { DiscoverySubscriptionStore } from './discovery-subscription.store';

const context = {
  viewport: {
    ne: { lat: 43.3, lng: 28.1 },
    sw: { lat: 43.1, lng: 27.8 },
  },
  zoom: 16,
  kinds: ['user'] as const,
};

const userPoint: DiscoveryPoint = {
  kind: 'user',
  id: 'nearby-user',
  lat: 43.2,
  lng: 27.9,
  meta: {
    displayName: 'Nearby user',
    avatarUrl: null,
    verification: 'none',
    online: false,
    lastSeenAt: null,
  },
};

describe('DiscoveryRealtimePublisher resolver concurrency', () => {
  it('resolves all candidates without running more than 16 viewer queries at once', async () => {
    const pendingResolvers: Array<(point: DiscoveryPoint) => void> = [];
    const resolveForViewer = jest.fn(
      () =>
        new Promise<DiscoveryPoint>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );
    const resolver = { resolveForViewer } as unknown as DiscoveryEntityResolver;
    const realtime = {
      to: jest.fn(() => ({ emit: jest.fn() })),
    } as unknown as RealtimeEmitterService;
    const candidates = Array.from({ length: 17 }, (_, index) => ({
      socketId: `socket-${index}`,
      viewerId: `viewer-${index}`,
      query: context,
    }));
    const subscriptions = {
      candidatesForEntity: jest.fn().mockReturnValue(candidates),
    } as unknown as DiscoverySubscriptionStore;

    let handler: ((mutation: Parameters<DiscoveryMutationBusService['publish']>[0]) => Promise<void>) | null = null;
    const mutationBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      setHandler: jest.fn((nextHandler) => {
        handler = nextHandler;
      }),
    } as unknown as DiscoveryMutationBusService;

    const publisher = new DiscoveryRealtimePublisher(
      realtime,
      resolver,
      subscriptions,
      mutationBus,
    );
    publisher.onModuleInit();

    const fanout = handler?.({
      type: 'change',
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(resolveForViewer).toHaveBeenCalledTimes(16);
    pendingResolvers.slice(0, 16).forEach((resolve) => resolve(userPoint));
    await Promise.resolve();
    await Promise.resolve();

    expect(resolveForViewer).toHaveBeenCalledTimes(17);
    pendingResolvers[16]?.(userPoint);
    await fanout;

    expect(resolveForViewer).toHaveBeenCalledTimes(17);
  });
});
