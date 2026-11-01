export interface MapCoachMarksVisibilityInput {
  shouldShow: boolean | null;
  mapReady: boolean;
  contextualSelectionVisible: boolean;
}

/**
 * Coach marks are first-session guidance, not a competing contextual surface.
 * Delay them while a selected map entity/place owns the interaction surface.
 */
export function shouldPresentMapCoachMarks({
  shouldShow,
  mapReady,
  contextualSelectionVisible,
}: MapCoachMarksVisibilityInput): boolean {
  return shouldShow === true && mapReady && !contextualSelectionVisible;
}
