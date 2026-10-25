import {
  mapLibreBoundsToViewport,
  mapLibreSnapshotToViewportChange,
  mapLibreViewStateToCamera,
} from '../mapLibreViewportAdapter';

describe('MapLibre viewport adapter', () => {
  const viewState = {
    center: [27.9147, 43.2141] as const,
    zoom: 14.25,
    bearing: 18,
    pitch: 35,
  };

  const bounds = {
    southWest: [27.85, 43.17] as const,
    northEast: [27.98, 43.26] as const,
  };

  it('maps MapLibre [lng, lat] camera state to renderer-neutral coordinates', () => {
    expect(mapLibreViewStateToCamera(viewState)).toEqual({
      center: { longitude: 27.9147, latitude: 43.2141 },
      zoom: 14.25,
      bearing: 18,
      pitch: 35,
    });
  });

  it('maps MapLibre bounds to the shared viewport contract', () => {
    expect(mapLibreBoundsToViewport(bounds)).toEqual({
      sw: { lng: 27.85, lat: 43.17 },
      ne: { lng: 27.98, lat: 43.26 },
    });
  });

  it('produces the viewport-settled payload expected by NexaMapSurface', () => {
    expect(mapLibreSnapshotToViewportChange(viewState, bounds)).toEqual({
      camera: {
        center: { longitude: 27.9147, latitude: 43.2141 },
        zoom: 14.25,
        bearing: 18,
        pitch: 35,
      },
      viewport: {
        sw: { lng: 27.85, lat: 43.17 },
        ne: { lng: 27.98, lat: 43.26 },
      },
    });
  });

  it('rejects invalid native coordinates before they reach discovery', () => {
    expect(() =>
      mapLibreViewStateToCamera({
        ...viewState,
        center: [181, 43.2141],
      }),
    ).toThrow('Invalid MapLibre center longitude');
  });

  it('rejects non-finite camera values', () => {
    expect(() =>
      mapLibreViewStateToCamera({ ...viewState, zoom: Number.NaN }),
    ).toThrow('Invalid MapLibre zoom');
  });
});
