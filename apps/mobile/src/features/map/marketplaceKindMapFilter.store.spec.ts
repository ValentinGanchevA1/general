import { marketplaceKindMapFilterStore } from './marketplaceKindMapFilter.store';

describe('marketplaceKindMapFilterStore', () => {
  beforeEach(() => {
    marketplaceKindMapFilterStore.reset();
  });

  it('defaults to all marketplace types', () => {
    expect(marketplaceKindMapFilterStore.getSnapshot()).toBe('all');
  });

  it('publishes first-class marketplace kind changes', () => {
    const listener = jest.fn();
    const unsubscribe = marketplaceKindMapFilterStore.subscribe(listener);

    marketplaceKindMapFilterStore.set('job');

    expect(marketplaceKindMapFilterStore.getSnapshot()).toBe('job');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('resets the narrow kind filter back to all', () => {
    marketplaceKindMapFilterStore.set('service');
    marketplaceKindMapFilterStore.reset();

    expect(marketplaceKindMapFilterStore.getSnapshot()).toBe('all');
  });

  it('does not emit when the value is unchanged', () => {
    const listener = jest.fn();
    const unsubscribe = marketplaceKindMapFilterStore.subscribe(listener);

    marketplaceKindMapFilterStore.set('all');

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
