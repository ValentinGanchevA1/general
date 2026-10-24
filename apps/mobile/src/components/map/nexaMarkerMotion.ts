export const NEXA_MARKER_TRACKING_WINDOW_MS = 250;
export const NEXA_MARKER_SELECTION_PULSE_TOTAL_MS = 200;

export function shouldAnimateNexaMarkerSelection(
  selected: boolean,
  reduceMotion: boolean,
): boolean {
  return selected && !reduceMotion;
}
