export const NEXA_MARKER_STATIC_TRACKING_WINDOW_MS = 100;
export const NEXA_MARKER_TRACKING_WINDOW_MS = 250;
export const NEXA_MARKER_SELECTION_PULSE_TOTAL_MS = 200;

export function markerTrackingWindowMs(selected: boolean): number {
  return selected
    ? NEXA_MARKER_TRACKING_WINDOW_MS
    : NEXA_MARKER_STATIC_TRACKING_WINDOW_MS;
}

export function shouldAnimateNexaMarkerSelection(
  selected: boolean,
  reduceMotion: boolean,
): boolean {
  return selected && !reduceMotion;
}
