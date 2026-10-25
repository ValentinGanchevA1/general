import type { DiscoveryEntityUpsertEvent, DiscoveryPoint } from '@g88/shared';

import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import type { RealtimeGateway } from './realtime.gateway';
import type { DiscoveryEntityResolver } from '../modules/discovery/discovery-entity-resolver.service';

describe('DiscoveryRealtimePublisher', () => {
  const createPublisher = (resolvedPoint: DiscoveryPoint | null = null) => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const realtime = { server: { to } } as unknown as RealtimeGateway;
    const resolveForViewer = jest.fn().mockResolvedValue(resolvedPoint);
    const resolver = { resolveForViewer } as unknown as DiscoveryEntityResolver;
    return {
      publisher: new DiscoveryRealtimePublisher(realtime, resolver),
      emit,
      to,
      resolveForViewer,
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
