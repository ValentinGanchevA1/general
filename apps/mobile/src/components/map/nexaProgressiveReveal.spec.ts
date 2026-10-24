import {
  NEXA_INITIAL_MARKER_REVEAL_COUNT,
  NEXA_MARKER_REVEAL_BATCH_SIZE,
  nextNexaMarkerRevealCount,
  resolveNexaMarkerRevealCountForBand,
  shouldResetNexaRevealForReplacement,
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

describe('shouldResetNexaRevealForReplacement', () => {
  it('resets when more than 60% of the previous spatial identities disappear', () => {
    const previous = Array.from({ length: 10 }, (_, index) => `p:${index}`);
    const next = ['p:0', 'p:1', 'p:2', 'n:0', 'n:1', 'n:2', 'n:3'];
    expect(shouldResetNexaRevealForReplacement(previous, next)).toBe(true);
  });

  it('does not reset at exactly the backend 60% fallback boundary', () => {
    const previous = Array.from({ length: 10 }, (_, index) => `p:${index}`);
    const next = ['p:0', 'p:1', 'p:2', 'p:3', 'n:0', 'n:1'];
    expect(shouldResetNexaRevealForReplacement(previous, next)).toBe(false);
  });

  it('does not reset for metadata churn when point identities stay stable', () => {
    expect(
      shouldResetNexaRevealForReplacement(
        ['user:a', 'event:b', 'listing:c'],
        ['user:a', 'event:b', 'listing:c'],
      ),
    ).toBe(false);
  });

  it('does not treat initial or empty states as a major replacement', () => {
    expect(shouldResetNexaRevealForReplacement([], ['user:a'])).toBe(false);
    expect(shouldResetNexaRevealForReplacement(['user:a'], [])).toBe(false);
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
