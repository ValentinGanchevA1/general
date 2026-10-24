import {
  NEXA_MARKER_SELECTION_PULSE_TOTAL_MS,
  NEXA_MARKER_STATIC_TRACKING_WINDOW_MS,
  NEXA_MARKER_TRACKING_WINDOW_MS,
  markerTrackingWindowMs,
  shouldAnimateNexaMarkerSelection,
} from './nexaMarkerMotion';

describe('NEXA marker motion budget', () => {
  it('keeps selection motion inside the selected react-native-maps tracking window', () => {
    expect(NEXA_MARKER_SELECTION_PULSE_TOTAL_MS).toBeLessThanOrEqual(
      NEXA_MARKER_TRACKING_WINDOW_MS,
    );
  });

  it('keeps static snapshot tracking shorter than selected motion tracking', () => {
    expect(NEXA_MARKER_STATIC_TRACKING_WINDOW_MS).toBeLessThan(
      NEXA_MARKER_TRACKING_WINDOW_MS,
    );
    expect(markerTrackingWindowMs(false)).toBe(
      NEXA_MARKER_STATIC_TRACKING_WINDOW_MS,
    );
    expect(markerTrackingWindowMs(true)).toBe(NEXA_MARKER_TRACKING_WINDOW_MS);
  });

  it('animates only selected markers when reduced motion is disabled', () => {
    expect(shouldAnimateNexaMarkerSelection(true, false)).toBe(true);
    expect(shouldAnimateNexaMarkerSelection(false, false)).toBe(false);
    expect(shouldAnimateNexaMarkerSelection(true, true)).toBe(false);
  });
});
