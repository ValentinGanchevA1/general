import { DiscoverySubscriptionGateway } from './discovery-subscription.gateway';
import { DiscoverySubscriptionStore } from './discovery-subscription.store';

const query = {
  viewport: {
    ne: { lat: 43.3, lng: 28.1 },
    sw: { lat: 43.1, lng: 27.8 },
  },
  zoom: 16,
  kinds: ['user'] as const,
};

describe('DiscoverySubscriptionGateway', () => {
  it('registers and replaces the authenticated socket context', () => {
    const store = new DiscoverySubscriptionStore();
    const gateway = new DiscoverySubscriptionGateway(store);
    const client = { id: 'socket-a', data: { userId: 'viewer-1' } };

    expect(gateway.onSubscribe(client as never, query)).toEqual({
      ok: true,
      data: { subscribed: true },
    });
    expect(store.get('socket-a')).toMatchObject({
      viewerId: 'viewer-1',
      query: { zoom: 16 },
    });

    gateway.onSubscribe(client as never, { ...query, zoom: 17 });
    expect(store.get('socket-a')?.query.zoom).toBe(17);
  });

  it('clears state on unsubscribe and disconnect idempotently', () => {
    const store = new DiscoverySubscriptionStore();
    const gateway = new DiscoverySubscriptionGateway(store);
    const client = { id: 'socket-a', data: { userId: 'viewer-1' } };

    gateway.onSubscribe(client as never, query);
    expect(gateway.onUnsubscribe(client as never)).toEqual({
      ok: true,
      data: { unsubscribed: true },
    });
    expect(store.get('socket-a')).toBeNull();

    gateway.handleDisconnect(client as never);
    expect(store.get('socket-a')).toBeNull();
  });
});
