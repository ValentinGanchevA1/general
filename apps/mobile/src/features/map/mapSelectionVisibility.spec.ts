import { mapSelectionVisibility } from './mapSelectionVisibility';

describe('mapSelectionVisibility', () => {
  beforeEach(() => {
    mapSelectionVisibility.setSelected(false);
  });

  it('publishes selection transitions to sibling map surfaces', () => {
    const listener = jest.fn();
    const unsubscribe = mapSelectionVisibility.subscribe(listener);

    mapSelectionVisibility.setSelected(true);
    expect(mapSelectionVisibility.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Repeating the same semantic state must not churn overlay subscribers.
    mapSelectionVisibility.setSelected(true);
    expect(listener).toHaveBeenCalledTimes(1);

    mapSelectionVisibility.setSelected(false);
    expect(mapSelectionVisibility.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});
