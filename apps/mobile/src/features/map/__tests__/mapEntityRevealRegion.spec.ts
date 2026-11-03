import { ENTITY_ZOOM_THRESHOLD, isEntityZoom } from '@g88/shared';
import type { Region } from 'react-native-maps';

import { regionForEntityReveal } from '../mapEntityRevealRegion';

function regionAtZoom(zoom: number): Region {
  const latitudeDelta = 360 / 2 ** zoom;
  return {
    latitude: 43.2077,
    longitude: 27.9167,
    latitudeDelta,
    longitudeDelta: latitudeDelta * 1.8,
  };
}

function discoveryZoom(region: Region): number {
  return Math.round(Math.log2(360 / Math.max(region.latitudeDelta, 0.0001)));
}

describe('regionForEntityReveal', () => {
  it.each([12, 13, 14])(
    'crosses the entity threshold from zoom %i in one step',
    (zoom) => {
      const target = regionForEntityReveal(regionAtZoom(zoom), {
        lat: 43.21,
        lng: 27.92,
      });

      expect(isEntityZoom(discoveryZoom(target))).toBe(true);
      expect(discoveryZoom(target)).toBeGreaterThanOrEqual(ENTITY_ZOOM_THRESHOLD);
    },
  );

  it('keeps the tapped cluster center as the camera target', () => {
    const target = regionForEntityReveal(regionAtZoom(12), {
      lat: 43.222,
      lng: 27.955,
    });

    expect(target.latitude).toBe(43.222);
    expect(target.longitude).toBe(27.955);
  });

  it('preserves the viewport aspect ratio while drilling in', () => {
    const source = regionAtZoom(13);
    const target = regionForEntityReveal(source, {
      lat: source.latitude,
      lng: source.longitude,
    });

    expect(target.longitudeDelta / target.latitudeDelta).toBeCloseTo(
      source.longitudeDelta / source.latitudeDelta,
      6,
    );
  });

  it('keeps already-close regions bounded by the minimum delta', () => {
    const target = regionForEntityReveal(
      {
        latitude: 43.2077,
        longitude: 27.9167,
        latitudeDelta: 0.006,
        longitudeDelta: 0.012,
      },
      { lat: 43.208, lng: 27.917 },
    );

    expect(target.latitudeDelta).toBe(0.005);
    expect(target.longitudeDelta).toBe(0.01);
    expect(isEntityZoom(discoveryZoom(target))).toBe(true);
  });

  it('uses a safe default viewport when region is not ready yet', () => {
    const target = regionForEntityReveal(null, { lat: 43.2, lng: 27.9 });

    expect(isEntityZoom(discoveryZoom(target))).toBe(true);
    expect(target.latitudeDelta).toBeGreaterThanOrEqual(0.005);
    expect(target.longitudeDelta).toBeGreaterThanOrEqual(0.005);
  });
});
