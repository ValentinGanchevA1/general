import {
  savedPlacesMapLayerStore,
  shouldResetSavedPlacesMapLayer,
} from './savedPlacesMapLayer.store';

describe('savedPlacesMapLayerStore', () => {
  beforeEach(() => {
    savedPlacesMapLayerStore.reset();
  });

  it('enables and resets the private saved-place overlay', () => {
    const listener = jest.fn();
    const unsubscribe = savedPlacesMapLayerStore.subscribe(listener);

    savedPlacesMapLayerStore.setEnabled(true);
    expect(savedPlacesMapLayerStore.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    savedPlacesMapLayerStore.reset();
    expect(savedPlacesMapLayerStore.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('resets when an authenticated session ends', () => {
    expect(shouldResetSavedPlacesMapLayer('user-a', null)).toBe(true);
  });

  it('resets on a direct account switch', () => {
    expect(shouldResetSavedPlacesMapLayer('user-a', 'user-b')).toBe(true);
  });

  it('does not reset for initial login or the same user', () => {
    expect(shouldResetSavedPlacesMapLayer(null, 'user-a')).toBe(false);
    expect(shouldResetSavedPlacesMapLayer('user-a', 'user-a')).toBe(false);
    expect(shouldResetSavedPlacesMapLayer(null, null)).toBe(false);
  });
});
