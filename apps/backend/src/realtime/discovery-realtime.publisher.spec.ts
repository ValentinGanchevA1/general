import type { DiscoveryEntityUpsertEvent, DiscoveryPoint } from '@g88/shared';

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
    const event: DiscoveryEntityUpsertEvent = { point: userPoint };

    publisher.emitEnter('viewer-1', event);

    expect(to).toHaveBeenCalledWith('user:viewer-1');
    expect(to).not.toHaveBeenCalledWith(expect.stringMatching(/^cell:/));
    expect(emit).toHaveBeenCalledWith('discovery:entity:enter', event);
  });

  it('fans out through bounded subscription candidates and active context', async () => {
    const { publisher, emit, to, resolveForViewer, candidatesForEntity } = createPublisher(userPoint);
    candidatesForEntity.mockReturnValueOnce([
      { socketId: 'socket-a', viewerId: 'viewer-1', query: context },
    ]);

    const published = await publisher.publishEntityChangeToSubscribers({
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
    expect(published).toBe(1);
  });

  it('emits a socket-scoped leave when an active candidate becomes ineligible', async () => {
    const { publisher, emit, candidatesForEntity } = createPublisher(null);
    candidatesForEntity.mockReturnValueOnce([
      { socketId: 'socket-a', viewerId: 'viewer-1', query: context },
    ]);

    const published = await publisher.publishEntityChangeToSubscribers({
      kind: 'user',
      entityId: 'nearby-user',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });

    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'user:nearby-user' });
    expect(published).toBe(0);
  });

  it('routes leave to previous-only subscriptions when an entity moves out', async () => {
    const { publisher, emit, to, resolveForViewer, candidatesForEntity } = createPublisher(userPoint);
    candidatesForEntity
      .mockReturnValueOnce([{ socketId: 'socket-old', viewerId: 'viewer-old', query: context }])
      .mockReturnValueOnce([{ socketId: 'socket-new', viewerId: 'viewer-new', query: context }]);

    const published = await publisher.publishEntityMovement({
      kind: 'user',
      entityId: 'nearby-user',
      previousLocation: { lat: 43.2, lng: 27.9 },
      location: { lat: 43.4, lng: 28.2 },
    });

    expect(to).toHaveBeenCalledWith('socket-old');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'user:nearby-user' });
    expect(resolveForViewer).not.toHaveBeenCalledWith(expect.objectContaining({ viewerId: 'viewer-old' }));
    expect(resolveForViewer).toHaveBeenCalledWith(expect.objectContaining({ viewerId: 'viewer-new' }));
    expect(published).toBe(1);
  });

  it('does not send leave when the same socket contains old and new locations', async () => {
    const { publisher, emit, candidatesForEntity } = createPublisher(userPoint);
    const candidate = { socketId: 'socket-a', viewerId: 'viewer-1', query: context };
    candidatesForEntity.mockReturnValueOnce([candidate]).mockReturnValueOnce([candidate]);

    await publisher.publishEntityMovement({
      kind: 'user',
      entityId: 'nearby-user',
      previousLocation: { lat: 43.2, lng: 27.9 },
      location: { lat: 43.21, lng: 27.91 },
    });

    expect(emit).not.toHaveBeenCalledWith('discovery:entity:leave', expect.anything());
    expect(emit).toHaveBeenCalledWith('discovery:entity:update', { point: userPoint });
  });

  it('emits canonical leave keys to the viewer room', () => {
    const { publisher, emit, to } = createPublisher();

    publisher.emitLeave('viewer-2', { key: 'listing:listing-1' });

    expect(to).toHaveBeenCalledWith('user:viewer-2');
    expect(emit).toHaveBeenCalledWith('discovery:entity:leave', { key: 'listing:listing-1' });
  });
});
