import {
  NEXA_INITIAL_MARKER_REVEAL_COUNT,
  NEXA_MARKER_REVEAL_BATCH_SIZE,
  nextNexaMarkerRevealCount,
  resolveNexaMarkerRevealCountForBand,
} from './nexaProgressiveReveal';

describe('resolveNexaMarkerRevealCountForBand', () => {
  it('resets the accumulated reveal budget when the zoom band changes', () => {
    expect(resolveNexaMarkerRevealCountForBand('city', 'neighborhood', 90)).toBe(
      NEXA_INITIAL_MARKER_REVEAL_COUNT,
    );
  });

  it('keeps the current reveal budget for same-band realtime updates', () => {
    expect(resolveNexaMarkerRevealCountForBand('nearby', 'nearby', 92)).toBe(92);
  });
});

describe('nextNexaMarkerRevealCount', () => {
  it('reveals all markers immediately when Reduced Motion is enabled', () => {
    expect(nextNexaMarkerRevealCount(0, 140, true)).toBe(140);
  });

  it('starts from the canonical initial reveal floor', () => {
    expect(nextNexaMarkerRevealCount(0, 140, false)).toBe(
      NEXA_INITIAL_MARKER_REVEAL_COUNT + NEXA_MARKER_REVEAL_BATCH_SIZE,
    );
  });

  it('never reveals more than the available marker count', () => {
    expect(nextNexaMarkerRevealCount(56, 63, false)).toBe(63);
  });

  it('returns zero when there is nothing to reveal', () => {
    expect(nextNexaMarkerRevealCount(28, 0, false)).toBe(0);
  });
});
