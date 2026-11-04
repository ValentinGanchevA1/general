import { nexaSpatialLensStore } from './nexaSpatialLens.store';

describe('map-first spatial lens', () => {
  afterEach(() => nexaSpatialLensStore.set('map'));

  it('notifies subscribers only on changes', () => {
    const listener = jest.fn();
    const unsubscribe = nexaSpatialLensStore.subscribe(listener);
    nexaSpatialLensStore.set('experiences');
    nexaSpatialLensStore.set('experiences');
    nexaSpatialLensStore.set('opportunities');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(nexaSpatialLensStore.getSnapshot()).toBe('opportunities');
    unsubscribe();
    nexaSpatialLensStore.set('map');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
