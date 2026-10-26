import type { DiscoveryEntityUpsertEvent, DiscoveryPoint } from '@g88/shared';

import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import type { RealtimeGateway } from './realtime.gateway';
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

describe('DiscoveryRealtimePublisher', () => {
  const createPublisher = (resolvedPoint: DiscoveryPoint | null = null) => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const realtime = { server: { to } } as unknown as RealtimeGateway;
    const resolveForViewer = jest.fn().mockResolvedValue(resolvedPoint);
    const resolver = { resolveForViewer } as unknown as DiscoveryEntityResolver;
    const candidatesForEntity = jest.fn().mockReturnValue([]);
    const subscriptions = { candidatesForEntity } as unknown as DiscoverySubscriptionStore;
    return {
      publisher: new DiscoveryRealtimePublisher(realtime, resolver, subscriptions),
      emit,
      to,
      resolveForViewer,
      candidatesForEntity,
    };
  };

  it('targets the authenticated viewer room instead of a shared cell room', () => {
    const { publisher, emit, to } = createPublisher();
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

  it('resolves a raw entity through the viewer privacy boundary before update', async () => {
    const point: DiscoveryPoint = {
      kind: 'user',
      id: 'nearby-user',
      lat: 42.7,
      lng: 23.3,
      meta: {
        displayName: 'Nearby user',
        avatarUrl: null,
        verification: 'none',
        online: false,
        lastSeenAt: null,
      },
    };
    const { publisher, emit, resolveForViewer } = createPublisher(point);

    const published = await publisher.publishEntityChange({
      viewerId: 'viewer-1',
      kind: 'user',
      entityId: 'nearby-user',
      change: 'update',
    });

    expect(resolveForViewer).toHaveBeenCalledWith({
      viewerId: 'viewer-1',
      kind: 'user',
      entityId: 'nearby-user',
    });
    expect(published).toBe(true);
    expect(emit).toHaveBeenCalledWith('discovery:entity:update', { point });
  });

  it('fans out through bounded subscription candidates and active context', async () => {
    const point: DiscoveryPoint = {
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
    const { publisher, emit, to, resolveForViewer, candidatesForEntity } = createPublisher(point);
    candidatesForEntity.mockReturnValueOnce([
      { socketId: 'socket-a', viewerId: 'viewer-1', query: context },
    ]);

    const published = await publisher.publishEntityChangeToSubscribers({
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(candidatesForEntity).toHaveBeenCalledWith('user', { lat: 43.2, lng: 27.9 });
    expect(resolveForViewer).toHaveBeenCalledWith({
      viewerId: 'viewer-1',
      kind: 'user',
      entityId: 'nearby-user',
      context,
    });
    expect(to).toHaveBeenCalledWith('socket-a');
    expect(emit).toHaveBeenCalledWith('discovery:entity:update', { point });
    expect(published).toBe(1);
  });

  it('emits a socket-scoped leave when an active candidate becomes ineligible', async () => {
    const { publisher, emit, to, candidatesForEntity } = createPublisher(null);
    candidatesForEntity.mockReturnValueOnce([
      { socketId: 'socket-a', viewerId: 'viewer-1', query: context },
    ]);

    const published = await publisher.publishEntityChangeToSubscribers({
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(to).toHaveBeenCalledWith('socket-a');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', {
      key: 'user:nearby-user',
    });
    expect(published).toBe(0);
  });

  it('routes leave to previous-only viewport subscriptions when an entity moves out', async () => {
    const point: DiscoveryPoint = {
      kind: 'user',
      id: 'nearby-user',
      lat: 43.4,
      lng: 28.2,
      meta: {
        displayName: 'Nearby user',
        avatarUrl: null,
        verification: 'none',
        online: false,
        lastSeenAt: null,
      },
    };
    const { publisher, emit, to, resolveForViewer, candidatesForEntity } = createPublisher(point);
    const previousOnly = { socketId: 'socket-old', viewerId: 'viewer-old', query: context };
    const current = { socketId: 'socket-new', viewerId: 'viewer-new', query: context };
    candidatesForEntity
      .mockReturnValueOnce([previousOnly])
      .mockReturnValueOnce([current]);

    const published = await publisher.publishEntityMovement({
      kind: 'user',
      entityId: 'nearby-user',
      previousLocation: { lat: 43.2, lng: 27.9 },
      location: { lat: 43.4, lng: 28.2 },
    });

    expect(candidatesForEntity).toHaveBeenNthCalledWith(1, 'user', { lat: 43.2, lng: 27.9 });
    expect(candidatesForEntity).toHaveBeenNthCalledWith(2, 'user', { lat: 43.4, lng: 28.2 });
    expect(to).toHaveBeenCalledWith('socket-old');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'user:nearby-user' });
    expect(resolveForViewer).not.toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: 'viewer-old' }),
    );
    expect(resolveForViewer).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: 'viewer-new', context }),
    );
    expect(to).toHaveBeenCalledWith('socket-new');
    expect(emit).toHaveBeenCalledWith('discovery:entity:update', { point });
    expect(published).toBe(1);
  });

  it('does not send leave when the same socket contains both old and new locations', async () => {
    const point: DiscoveryPoint = {
      kind: 'user',
      id: 'nearby-user',
      lat: 43.21,
      lng: 27.91,
      meta: {
        displayName: 'Nearby user',
        avatarUrl: null,
        verification: 'none',
        online: false,
        lastSeenAt: null,
      },
    };
    const { publisher, emit, candidatesForEntity } = createPublisher(point);
    const candidate = { socketId: 'socket-a', viewerId: 'viewer-1', query: context };
    candidatesForEntity.mockReturnValueOnce([candidate]).mockReturnValueOnce([candidate]);

    await publisher.publishEntityMovement({
      kind: 'user',
      entityId: 'nearby-user',
      previousLocation: { lat: 43.2, lng: 27.9 },
      location: { lat: 43.21, lng: 27.91 },
    });

    expect(emit).not.toHaveBeenCalledWith('discovery:entity:leave', expect.anything());
    expect(emit).toHaveBeenCalledWith('discovery:entity:update', { point });
  });

  it('does not emit when the viewer-safe resolver hides the entity', async () => {
    const { publisher, emit } = createPublisher(null);

    const published = await publisher.publishEntityChange({
      viewerId: 'viewer-1',
      kind: 'listing',
      entityId: 'listing-1',
      change: 'enter',
    });

    expect(published).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits canonical leave keys to the viewer room', () => {
    const { publisher, emit, to } = createPublisher();

    publisher.emitLeave('viewer-2', { key: 'listing:listing-1' });

    expect(to).toHaveBeenCalledWith('user:viewer-2');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', {
      key: 'listing:listing-1',
    });
  });
});
