import type { DiscoverySubscriptionPayload } from '@g88/shared';
import { DiscoverySubscriptionStore } from './discovery-subscription.store';

const query: DiscoverySubscriptionPayload = {
  viewport: {
    ne: { lat: 43.3, lng: 28.1 },
    sw: { lat: 43.1, lng: 27.8 },
  },
  zoom: 16,
  kinds: ['user'],
  friendsOnly: true,
};

describe('DiscoverySubscriptionStore', () => {
  it('replaces one socket context without affecting another socket for the same viewer', () => {
    const store = new DiscoverySubscriptionStore();
    store.set('socket-a', 'viewer-1', query);
    store.set('socket-b', 'viewer-1', { ...query, zoom: 17 });
    store.set('socket-a', 'viewer-1', { ...query, zoom: 18 });

    expect(store.get('socket-a')?.query.zoom).toBe(18);
    expect(store.get('socket-b')?.query.zoom).toBe(17);
  });

  it('deletes subscription state idempotently', () => {
    const store = new DiscoverySubscriptionStore();
    store.set('socket-a', 'viewer-1', query);

    store.delete('socket-a');
    store.delete('socket-a');

    expect(store.get('socket-a')).toBeNull();
  });

  it('returns only entity-zoom subscriptions whose viewport and kinds can contain the entity', () => {
    const store = new DiscoverySubscriptionStore();
    store.set('matching', 'viewer-1', query);
    store.set('cluster-zoom', 'viewer-2', { ...query, zoom: 14 });
    store.set('wrong-kind', 'viewer-3', { ...query, kinds: ['event'] });
    store.set('outside', 'viewer-4', {
      ...query,
      viewport: {
        ne: { lat: 42.8, lng: 27.5 },
        sw: { lat: 42.6, lng: 27.2 },
      },
    });

    expect(store.candidatesForEntity('user', { lat: 43.2, lng: 27.9 })).toEqual([
      expect.objectContaining({ socketId: 'matching', viewerId: 'viewer-1' }),
    ]);
  });

  it('handles antimeridian viewports', () => {
    const store = new DiscoverySubscriptionStore();
    const antimeridianQuery: DiscoverySubscriptionPayload = {
      viewport: {
        ne: { lat: 10, lng: -170 },
        sw: { lat: -10, lng: 170 },
      },
      zoom: 16,
      kinds: ['listing'],
    };
    store.set('socket-a', 'viewer-1', antimeridianQuery);
    store.set('socket-b', 'viewer-2', antimeridianQuery);

    expect(store.candidatesForEntity('listing', { lat: 0, lng: 179 })).toEqual([
      expect.objectContaining({ socketId: 'socket-a' }),
      expect.objectContaining({ socketId: 'socket-b' }),
    ]);
  });

  it('returns every matching local subscription beyond the legacy 500 candidate cap', () => {
    const store = new DiscoverySubscriptionStore();
    for (let index = 0; index < 501; index += 1) {
      store.set(`socket-${index}`, `viewer-${index}`, query);
    }

    const candidates = store.candidatesForEntity('user', { lat: 43.2, lng: 27.9 });

    expect(candidates).toHaveLength(501);
    expect(candidates[500]).toEqual(
      expect.objectContaining({ socketId: 'socket-500', viewerId: 'viewer-500' }),
    );
  });

  it('does not select user subscriptions when a topic filter is active', () => {
    const store = new DiscoverySubscriptionStore();
    store.set('socket-a', 'viewer-1', { ...query, friendsOnly: false, topic: 'music' });

    expect(store.candidatesForEntity('user', { lat: 43.2, lng: 27.9 })).toEqual([]);
  });
});
