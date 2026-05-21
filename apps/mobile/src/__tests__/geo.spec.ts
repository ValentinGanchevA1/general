import {
  fuzzLocation,
  h3ResolutionForZoom,
  haversineMeters,
  isEntityZoom,
  ENTITY_ZOOM_THRESHOLD,
} from '@g88/shared';

describe('fuzzLocation', () => {
  const sofia = { lat: 42.6977, lng: 23.3219 };

  it('returns valid lat/lng', () => {
    const out = fuzzLocation(sofia);
    expect(out.lat).toBeGreaterThan(-90);
    expect(out.lat).toBeLessThan(90);
    expect(out.lng).toBeGreaterThan(-180);
    expect(out.lng).toBeLessThan(180);
  });

  it('snaps to within ~200m of the input at r10', () => {
    const fuzzed = fuzzLocation(sofia, 10);
    expect(haversineMeters(sofia, fuzzed)).toBeLessThan(200);
  });

  it('is idempotent — snapping an already-snapped point is a no-op', () => {
    const once = fuzzLocation(sofia, 10);
    const twice = fuzzLocation(once, 10);
    expect(twice).toEqual(once);
  });

  it('coarser resolution produces larger displacement', () => {
    const r10 = haversineMeters(sofia, fuzzLocation(sofia, 10));
    const r5 = haversineMeters(sofia, fuzzLocation(sofia, 5));
    // r5 cells are much larger so displacement must be >= r10 displacement
    expect(r5).toBeGreaterThanOrEqual(r10);
  });
});

describe('h3ResolutionForZoom', () => {
  it('returns coarse resolution at low zoom', () => {
    expect(h3ResolutionForZoom(3)).toBeLessThanOrEqual(4);
  });

  it('returns fine resolution at high zoom', () => {
    expect(h3ResolutionForZoom(18)).toBeGreaterThanOrEqual(9);
  });

  it('resolution is monotonically non-decreasing with zoom', () => {
    const zooms = [1, 5, 8, 12, 15, 18, 20];
    const resolutions = zooms.map(h3ResolutionForZoom);
    for (let i = 1; i < resolutions.length; i++) {
      expect(resolutions[i]).toBeGreaterThanOrEqual(resolutions[i - 1]!);
    }
  });

  it('returns a value in the valid H3 range [0, 15]', () => {
    for (const zoom of [0, 5, 10, 15, 20, 22]) {
      const res = h3ResolutionForZoom(zoom);
      expect(res).toBeGreaterThanOrEqual(0);
      expect(res).toBeLessThanOrEqual(15);
    }
  });
});

describe('isEntityZoom / ENTITY_ZOOM_THRESHOLD', () => {
  it('returns false below the threshold', () => {
    expect(isEntityZoom(ENTITY_ZOOM_THRESHOLD - 1)).toBe(false);
  });

  it('returns true at or above the threshold', () => {
    expect(isEntityZoom(ENTITY_ZOOM_THRESHOLD)).toBe(true);
    expect(isEntityZoom(ENTITY_ZOOM_THRESHOLD + 1)).toBe(true);
  });
});
