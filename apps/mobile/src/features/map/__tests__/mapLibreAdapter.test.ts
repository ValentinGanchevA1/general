import {
  mapLibreBoundsToViewport,
  mapLibreSnapshotToViewportChange,
  mapLibreViewStateToCamera,
} from '../mapLibreAdapter';

describe('mapLibreAdapter', () => {
  it('maps MapLibre [longitude, latitude] camera coordinates', () => {
    expect(
      mapLibreViewStateToCamera({
        center: [27.9147, 43.2141],
        zoom: 15,
        bearing: 12,
        pitch: 35,
      }),
    ).toEqual({
      center: { longitude: 27.9147, latitude: 43.2141 },
      zoom: 15,
      bearing: 12,
      pitch: 35,
    });
  });

  it('maps MapLibre bounds to the shared viewport contract', () => {
    expect(
      mapLibreBoundsToViewport({
        southWest: [27.8, 43.1],
        northEast: [28.0, 43.3],
      }),
    ).toEqual({
      sw: { lng: 27.8, lat: 43.1 },
      ne: { lng: 28.0, lat: 43.3 },
    });
  });

  it('combines camera and viewport snapshots without renderer leakage', () => {
    expect(
      mapLibreSnapshotToViewportChange(
        {
          center: [27.9147, 43.2141],
          zoom: 16,
          bearing: 0,
          pitch: 0,
        },
        {
          southWest: [27.8, 43.1],
          northEast: [28.0, 43.3],
        },
      ),
    ).toEqual({
      camera: {
        center: { longitude: 27.9147, latitude: 43.2141 },
        zoom: 16,
        bearing: 0,
        pitch: 0,
      },
      viewport: {
        sw: { lng: 27.8, lat: 43.1 },
        ne: { lng: 28.0, lat: 43.3 },
      },
    });
  });

  it('accepts antimeridian-crossing bounds', () => {
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

  it('rejects invalid longitude', () => {
    expect(() =>
      mapLibreBoundsToViewport({
        southWest: [181, 0],
        northEast: [0, 0],
      }),
    ).toThrow('Invalid MapLibre south-west longitude');
  });

  it('rejects non-finite camera values', () => {
    expect(() =>
      mapLibreViewStateToCamera({
        center: [0, 0],
        zoom: Number.NaN,
        bearing: 0,
        pitch: 0,
      }),
    ).toThrow('Invalid MapLibre zoom');
  });
});
