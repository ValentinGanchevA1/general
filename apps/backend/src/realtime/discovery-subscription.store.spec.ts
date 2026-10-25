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
});
