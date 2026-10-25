import {
  mapLibreBoundsToViewport,
  mapLibreSnapshotToViewportChange,
  mapLibreViewStateToCamera,
} from '../mapLibreAdapter';

describe('mapLibreAdapter', () => {
  const viewState = {
    center: [27.9167, 43.2167] as const,
    zoom: 15,
    bearing: 12,
    pitch: 24,
  };

  const bounds = {
    southWest: [27.8, 43.1] as const,
    northEast: [28.0, 43.3] as const,
  };

  it('maps MapLibre [longitude, latitude] camera coordinates', () => {
    expect(mapLibreViewStateToCamera(viewState)).toEqual({
      center: { longitude: 27.9167, latitude: 43.2167 },
      zoom: 15,
      bearing: 12,
      pitch: 24,
    });
  });

  it('maps MapLibre bounds into the shared viewport contract', () => {
    expect(mapLibreBoundsToViewport(bounds)).toEqual({
      sw: { lng: 27.8, lat: 43.1 },
      ne: { lng: 28.0, lat: 43.3 },
    });
  });

  it('creates one renderer-neutral viewport change snapshot', () => {
    expect(mapLibreSnapshotToViewportChange(viewState, bounds)).toEqual({
      camera: {
        center: { longitude: 27.9167, latitude: 43.2167 },
        zoom: 15,
        bearing: 12,
        pitch: 24,
      },
      viewport: {
        sw: { lng: 27.8, lat: 43.1 },
        ne: { lng: 28.0, lat: 43.3 },
      },
    });
  });

  it('rejects an invalid longitude', () => {
    expect(() =>
      mapLibreViewStateToCamera({
        ...viewState,
        center: [181, 43.2167],
      }),
    ).toThrow('Invalid MapLibre center longitude');
  });

  it('rejects non-finite camera values', () => {
    expect(() =>
      mapLibreViewStateToCamera({ ...viewState, zoom: Number.NaN }),
    ).toThrow('Invalid MapLibre zoom');
  });

  it('allows antimeridian-crossing bounds without reordering them', () => {
    expect(
      mapLibreBoundsToViewport({
        southWest: [170, -10],
        northEast: [-170, 10],
      }),
    ).toEqual({
      sw: { lng: 170, lat: -10 },
      ne: { lng: -170, lat: 10 },
    });
  });
});
