import {
  hasContextualMapSelection,
  mapSelectionVisibility,
} from './mapSelectionVisibility';

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

  it('treats renderer-agnostic entity and place selections as contextual surfaces', () => {
    expect(hasContextualMapSelection(null)).toBe(false);
    expect(hasContextualMapSelection('user:user-1')).toBe(true);
    expect(hasContextualMapSelection('event:event-1')).toBe(true);
    expect(hasContextualMapSelection('listing:listing-1')).toBe(true);
    expect(hasContextualMapSelection('place:place-1')).toBe(true);
  });
});
