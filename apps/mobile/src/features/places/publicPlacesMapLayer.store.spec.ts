import { publicPlacesMapLayerStore } from './publicPlacesMapLayer.store';

describe('publicPlacesMapLayerStore', () => {
  beforeEach(() => {
    publicPlacesMapLayerStore.reset();
  });

  it('defaults to showing the public Places layer', () => {
    expect(publicPlacesMapLayerStore.getSnapshot()).toBe(true);
  });

  it('toggles the public layer without affecting private place state', () => {
    const listener = jest.fn();
    const unsubscribe = publicPlacesMapLayerStore.subscribe(listener);

    publicPlacesMapLayerStore.setEnabled(false);
    expect(publicPlacesMapLayerStore.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    publicPlacesMapLayerStore.setEnabled(true);
    expect(publicPlacesMapLayerStore.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('resets to the default visible state', () => {
    publicPlacesMapLayerStore.setEnabled(false);
    publicPlacesMapLayerStore.reset();

    expect(publicPlacesMapLayerStore.getSnapshot()).toBe(true);
  });
});
