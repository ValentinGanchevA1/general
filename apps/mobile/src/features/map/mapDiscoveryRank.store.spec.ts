import { mapDiscoveryRankStore } from './mapDiscoveryRank.store';

describe('mapDiscoveryRankStore', () => {
  beforeEach(() => {
    mapDiscoveryRankStore.reset();
  });

  it('defaults to relevance', () => {
    expect(mapDiscoveryRankStore.getSnapshot()).toBe('relevance');
  });

  it('publishes rank changes and deduplicates identical values', () => {
    const listener = jest.fn();
    const unsubscribe = mapDiscoveryRankStore.subscribe(listener);

    mapDiscoveryRankStore.set('distance');
    mapDiscoveryRankStore.set('distance');

    expect(mapDiscoveryRankStore.getSnapshot()).toBe('distance');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('resets to relevance for a new map session', () => {
    mapDiscoveryRankStore.set('newest');
    mapDiscoveryRankStore.reset();

    expect(mapDiscoveryRankStore.getSnapshot()).toBe('relevance');
  });
});
