import {
  diamondSideForBoundingSize,
  NEXA_MARKER_TOUCH_SIZE,
  NEXA_MARKER_VISUAL_SIZE,
  resolveNexaMarkerVisual,
} from './nexaEntityMarkerVisuals';

describe('NEXA entity marker visual contract', () => {
  it('keeps a 48dp minimum marker stage for reliable Android taps', () => {
    expect(NEXA_MARKER_TOUCH_SIZE).toBe(48);
  });

  it('maps entity types to the final canonical geometry', () => {
    expect(resolveNexaMarkerVisual('person').shape).toBe('circle');
    expect(resolveNexaMarkerVisual('event').shape).toBe('star');
    expect(resolveNexaMarkerVisual('listing').shape).toBe('square');
    expect(resolveNexaMarkerVisual('opportunity').shape).toBe('diamond');
  });

  it('uses compact/standard sizes and makes selection dominate either density', () => {
    expect(resolveNexaMarkerVisual('person', 'compact').visualSize).toBe(
      NEXA_MARKER_VISUAL_SIZE.compact,
    );
    expect(resolveNexaMarkerVisual('person', 'standard').visualSize).toBe(
      NEXA_MARKER_VISUAL_SIZE.standard,
    );
    expect(
      resolveNexaMarkerVisual('person', 'compact', { selected: true }).visualSize,
    ).toBe(NEXA_MARKER_VISUAL_SIZE.selected);
    expect(NEXA_MARKER_VISUAL_SIZE.selected).toBeGreaterThan(
      NEXA_MARKER_VISUAL_SIZE.standard,
    );
    expect(NEXA_MARKER_VISUAL_SIZE.selected).toBeGreaterThanOrEqual(34);
  });

  it('preserves combinable state modifiers', () => {
    const visual = resolveNexaMarkerVisual('person', 'standard', {
      selected: true,
      live: true,
      verified: true,
      isNew: true,
      own: true,
    });

    expect(visual.showSelectedRing).toBe(true);
    expect(visual.showLiveRing).toBe(true);
    expect(visual.showVerifiedBadge).toBe(true);
    expect(visual.showNewDot).toBe(true);
    expect(visual.showOwnRing).toBe(true);
  });

  it('gives unavailable precedence over dimmed opacity', () => {
    expect(
      resolveNexaMarkerVisual('event', 'standard', {
        dimmed: true,
        unavailable: true,
      }).opacity,
    ).toBe(0.35);
    expect(
      resolveNexaMarkerVisual('event', 'standard', { dimmed: true }).opacity,
    ).toBe(0.42);
  });

  it('constructs diamonds inside the requested bounding size', () => {
    const side = diamondSideForBoundingSize(24);
    expect(side * Math.SQRT2).toBeCloseTo(24, 5);
  });
});
