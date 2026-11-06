import { nexaMapFilterIntentStore } from './nexaMapFilterIntent.store';

describe('Session-only manual map filter intent', () => {
  afterEach(() => nexaMapFilterIntentStore.reset());

  it('fails closed when MapScreen has not published its filters', () => {
    expect(nexaMapFilterIntentStore.getSnapshot()).toEqual({
      known: false, hasExplicitFilters: true,
    });
  });

  it('publishes only a boolean summary and not any private filter contents', () => {
    nexaMapFilterIntentStore.publish(false);
    expect(nexaMapFilterIntentStore.getSnapshot()).toEqual({
      known: true, hasExplicitFilters: false,
    });
    nexaMapFilterIntentStore.publish(true);
    expect(nexaMapFilterIntentStore.getSnapshot()).toEqual({
      known: true, hasExplicitFilters: true,
    });
    expect(Object.keys(nexaMapFilterIntentStore.getSnapshot()))
      .toEqual(['known', 'hasExplicitFilters']);
  });

  it('notifies only on state changes and resets to unknown at map unmount', () => {
    const listener = jest.fn();
    const off = nexaMapFilterIntentStore.subscribe(listener);
    nexaMapFilterIntentStore.publish(false);
    nexaMapFilterIntentStore.publish(false);
    nexaMapFilterIntentStore.publish(true);
    expect(listener).toHaveBeenCalledTimes(2);
    nexaMapFilterIntentStore.reset();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(nexaMapFilterIntentStore.getSnapshot().known).toBe(false);
    off();
    nexaMapFilterIntentStore.publish(false);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
