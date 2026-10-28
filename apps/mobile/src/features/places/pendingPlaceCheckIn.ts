let pendingPlaceId: string | null = null;

/**
 * One-shot in-memory intent used only to open the explicit audience chooser
 * after a map-sheet Check in action. No location or audience is stored here.
 */
export function setPendingPlaceCheckIn(placeId: string): void {
  pendingPlaceId = placeId;
}

export function takePendingPlaceCheckIn(placeId: string): boolean {
  if (pendingPlaceId !== placeId) return false;
  pendingPlaceId = null;
  return true;
}

export function clearPendingPlaceCheckIn(): void {
  pendingPlaceId = null;
}
