import { DiscoverySubscriptionDto } from './realtime.dto';
import { DiscoverySubscriptionGateway } from './discovery-subscription.gateway';
import { DiscoverySubscriptionStore } from './discovery-subscription.store';

const query: DiscoverySubscriptionDto = {
  viewport: {
    ne: { lat: 43.3, lng: 28.1 },
    sw: { lat: 43.1, lng: 27.8 },
  },
  zoom: 16,
  kinds: ['user'],
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

  it('rejects oversized viewports without replacing the active subscription', () => {
    const store = new DiscoverySubscriptionStore();
    const gateway = new DiscoverySubscriptionGateway(store);
    const client = { id: 'socket-a', data: { userId: 'viewer-1' } };

    gateway.onSubscribe(client as never, query);
    const result = gateway.onSubscribe(client as never, {
      ...query,
      viewport: {
        sw: { lat: 10, lng: 20 },
        ne: { lat: 26, lng: 21 },
      },
      zoom: 18,
    });

    expect(result).toEqual({
      ok: false,
      code: 'discovery.viewport_too_large',
      message: 'Discovery viewport must span at most 15 degrees per axis.',
    });
    expect(store.get('socket-a')?.query.zoom).toBe(16);
  });

  it('accepts a bounded viewport crossing the antimeridian', () => {
    const store = new DiscoverySubscriptionStore();
    const gateway = new DiscoverySubscriptionGateway(store);
    const client = { id: 'socket-a', data: { userId: 'viewer-1' } };

    const result = gateway.onSubscribe(client as never, {
      ...query,
      viewport: {
        sw: { lat: -5, lng: 175 },
        ne: { lat: 5, lng: -175 },
      },
    });

    expect(result).toEqual({ ok: true, data: { subscribed: true } });
    expect(store.get('socket-a')).not.toBeNull();
  });

  it('rejects inverted latitude bounds', () => {
    const store = new DiscoverySubscriptionStore();
    const gateway = new DiscoverySubscriptionGateway(store);
    const client = { id: 'socket-a', data: { userId: 'viewer-1' } };

    expect(gateway.onSubscribe(client as never, {
      ...query,
      viewport: {
        sw: { lat: 20, lng: 20 },
        ne: { lat: 10, lng: 21 },
      },
    })).toMatchObject({
      ok: false,
      code: 'discovery.viewport_too_large',
    });
    expect(store.get('socket-a')).toBeNull();
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
