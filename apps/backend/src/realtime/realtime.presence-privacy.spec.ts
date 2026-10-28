import { approximatePublicLocation } from './realtime.gateway';

describe('legacy presence delta location privacy', () => {
  it('snaps public coordinates to the same 0.02 degree grid as discovery', () => {
    expect(approximatePublicLocation(43.21357, 27.93461)).toEqual({
      lat: 43.22,
      lng: 27.94,
    });
  });

  it('does not disclose precise coordinates in the emitted position', () => {
    const raw = { lat: 43.21357, lng: 27.93461 };
    const publicPosition = approximatePublicLocation(raw.lat, raw.lng);
    expect(publicPosition.lat).not.toBe(raw.lat);
    expect(publicPosition.lng).not.toBe(raw.lng);
  });

  it('handles negative coordinates consistently', () => {
    const result = approximatePublicLocation(-12.345, -77.031);
    expect(result.lat).toBeCloseTo(-12.34);
    expect(result.lng).toBeCloseTo(-77.04);
  });
});
