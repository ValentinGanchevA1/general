export interface PrivatePlacePreviewDismissInput {
  savedPlacesEnabled: boolean;
  selectedPlaceId: string | null;
  privateSelectedPlaceId: string | null;
  focusedPlaceId: string | null;
}

/**
 * A private Saved-layer pin should disappear when the layer is disabled.
 * A one-shot focus request is independent from layer visibility and must remain
 * visible until the focused preview is dismissed or the session clears it.
 */
export function shouldDismissPrivatePlacePreview({
  savedPlacesEnabled,
  selectedPlaceId,
  privateSelectedPlaceId,
  focusedPlaceId,
}: PrivatePlacePreviewDismissInput): boolean {
  if (savedPlacesEnabled || selectedPlaceId == null) return false;
  if (focusedPlaceId === selectedPlaceId) return false;
  return privateSelectedPlaceId === selectedPlaceId;
}
