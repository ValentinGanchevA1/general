import type { DiscoveryEntityUpsertEvent, DiscoveryPoint } from '@g88/shared';

import type { DiscoveryMutationBusService } from './discovery-mutation-bus.service';
import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import type { RealtimeEmitterService } from './realtime-emitter.service';
import type { DiscoveryEntityResolver } from '../modules/discovery/discovery-entity-resolver.service';
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

describe('DiscoveryRealtimePublisher', () => {
  const createPublisher = (resolvedPoint: DiscoveryPoint | null = null) => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const realtime = { to } as unknown as RealtimeEmitterService;
    const resolveForViewer = jest.fn().mockResolvedValue(resolvedPoint);
    const resolver = { resolveForViewer } as unknown as DiscoveryEntityResolver;
    const candidatesForEntity = jest.fn().mockReturnValue([]);
    const subscriptions = { candidatesForEntity } as unknown as DiscoverySubscriptionStore;
    const publish = jest.fn().mockResolvedValue(undefined);
    let handler: ((mutation: Parameters<DiscoveryMutationBusService['publish']>[0]) => Promise<void>) | null = null;
    const setHandler = jest.fn((nextHandler) => {
      handler = nextHandler;
    });
    const mutationBus = { publish, setHandler } as unknown as DiscoveryMutationBusService;
    const publisher = new DiscoveryRealtimePublisher(realtime, resolver, subscriptions, mutationBus);
    publisher.onModuleInit();
    return {
      publisher,
      publish,
      handler: () => handler,
      emit,
      to,
      resolveForViewer,
      candidatesForEntity,
    };
  };

  it('targets the authenticated viewer room instead of a shared cell room', () => {
    const { publisher, emit, to } = createPublisher();
    const event: DiscoveryEntityUpsertEvent = { point: userPoint };

    publisher.emitEnter('viewer-1', event);

    expect(to).toHaveBeenCalledWith('user:viewer-1');
    expect(to).not.toHaveBeenCalledWith(expect.stringMatching(/^cell:/));
    expect(emit).toHaveBeenCalledWith('discovery:entity:enter', event);
  });

  it('publishes subscriber changes to the shared mutation bus', async () => {
    const { publisher, publish } = createPublisher(userPoint);

    await publisher.publishEntityChangeToSubscribers({
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(publish).toHaveBeenCalledWith({
      type: 'change',
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });
  });

  it('fans out a consumed mutation through local candidates and active context', async () => {
    const { emit, to, resolveForViewer, candidatesForEntity, handler } = createPublisher(userPoint);
    candidatesForEntity.mockReturnValueOnce([
      { socketId: 'socket-a', viewerId: 'viewer-1', query: context },
    ]);

    await handler()?.({
      type: 'change',
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(resolveForViewer).toHaveBeenCalledWith({
      viewerId: 'viewer-1',
      kind: 'user',
      entityId: 'nearby-user',
      context,
    });
    expect(to).toHaveBeenCalledWith('socket-a');
    expect(emit).toHaveBeenCalledWith('discovery:entity:update', { point: userPoint });
  });

  it('emits a socket-scoped leave when a consumed candidate becomes ineligible', async () => {
    const { emit, candidatesForEntity, handler } = createPublisher(null);
    candidatesForEntity.mockReturnValueOnce([
      { socketId: 'socket-a', viewerId: 'viewer-1', query: context },
    ]);

    await handler()?.({
      type: 'change',
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'user:nearby-user' });
  });

  it('routes movement leaves and updates when consumed on another instance', async () => {
    const { emit, to, resolveForViewer, candidatesForEntity, handler } = createPublisher(userPoint);
    candidatesForEntity
      .mockReturnValueOnce([{ socketId: 'socket-old', viewerId: 'viewer-old', query: context }])
      .mockReturnValueOnce([{ socketId: 'socket-new', viewerId: 'viewer-new', query: context }]);

    await handler()?.({
      type: 'movement',
      kind: 'user',
      entityId: 'nearby-user',
      previousLocation: { lat: 43.2, lng: 27.9 },
      location: { lat: 43.4, lng: 28.2 },
    });

    expect(to).toHaveBeenCalledWith('socket-old');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'user:nearby-user' });
    expect(resolveForViewer).not.toHaveBeenCalledWith(expect.objectContaining({ viewerId: 'viewer-old' }));
    expect(resolveForViewer).toHaveBeenCalledWith(expect.objectContaining({ viewerId: 'viewer-new' }));
  });

  it('emits canonical leave keys to the viewer room', () => {
    const { publisher, emit, to } = createPublisher();

    publisher.emitLeave('viewer-2', { key: 'listing:listing-1' });

    expect(to).toHaveBeenCalledWith('user:viewer-2');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'listing:listing-1' });
  });
});
