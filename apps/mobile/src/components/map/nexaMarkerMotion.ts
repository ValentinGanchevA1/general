export const NEXA_MARKER_TRACKING_WINDOW_MS = 250;
export const NEXA_MARKER_SELECTION_PULSE_IN_MS = 110;
export const NEXA_MARKER_SELECTION_PULSE_OUT_MS = 90;
export const NEXA_MARKER_SELECTION_PULSE_TOTAL_MS =
  NEXA_MARKER_SELECTION_PULSE_IN_MS + NEXA_MARKER_SELECTION_PULSE_OUT_MS;

export function shouldAnimateNexaMarkerSelection(
  selected: boolean,
  reduceMotion: boolean,
): boolean {
  return selected && !reduceMotion;
}
