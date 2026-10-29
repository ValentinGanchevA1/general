import { shouldDismissPrivatePlacePreview } from './placePreviewLifecycle';

describe('shouldDismissPrivatePlacePreview', () => {
  it('keeps a focused saved place visible when the Saved layer is off', () => {
    expect(shouldDismissPrivatePlacePreview({
      savedPlacesEnabled: false,
      selectedPlaceId: 'place-1',
      privateSelectedPlaceId: 'place-1',
      focusedPlaceId: 'place-1',
    })).toBe(false);
  });

  it('dismisses a private Saved-layer selection when the layer is disabled', () => {
    expect(shouldDismissPrivatePlacePreview({
      savedPlacesEnabled: false,
      selectedPlaceId: 'place-1',
      privateSelectedPlaceId: 'place-1',
      focusedPlaceId: null,
    })).toBe(true);
  });

  it('keeps a private selection while the Saved layer remains enabled', () => {
    expect(shouldDismissPrivatePlacePreview({
      savedPlacesEnabled: true,
      selectedPlaceId: 'place-1',
      privateSelectedPlaceId: 'place-1',
      focusedPlaceId: null,
    })).toBe(false);
  });

  it('does not dismiss a public or unrelated selection', () => {
    expect(shouldDismissPrivatePlacePreview({
      savedPlacesEnabled: false,
      selectedPlaceId: 'place-2',
      privateSelectedPlaceId: 'place-1',
      focusedPlaceId: null,
    })).toBe(false);
  });
});
