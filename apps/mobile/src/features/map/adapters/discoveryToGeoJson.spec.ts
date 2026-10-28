import type { MapClusterPoint, PlaceMapEntityPoint } from '@g88/shared';

import {
  discoveryPointToMapFeature,
  discoveryToMapFeatureCollection,
  updateMapFeatureCollection,
} from './discoveryToGeoJson';

const SAVED_PLACE: PlaceMapEntityPoint = {
  kind: 'place',
  id: 'place-1',
  lat: 43.207,
  lng: 27.927,
  meta: {
    canonicalLabel: 'Sea Garden',
    trending: false,
    recentActivityAt: null,
    locationPrecision: 'coarse',
    saved: true,
  },
};

const UNSAVED_PLACE: PlaceMapEntityPoint = {
  ...SAVED_PLACE,
  meta: {
    ...SAVED_PLACE.meta,
    saved: false,
  },
};

const CLUSTER: MapClusterPoint = {
  kind: 'cluster',
  cellId: '8928308280fffff',
  lat: 43.21,
  lng: 27.93,
  count: 7,
  by: { place: 2, user: 5 },
};

describe('discoveryToGeoJson private place state', () => {
  it('exposes saved only for the viewer-private place feature', () => {
    const saved = discoveryPointToMapFeature(SAVED_PLACE);
    const cluster = discoveryPointToMapFeature(CLUSTER);

    expect(saved.id).toBe('place:place-1');
    expect(saved.properties.saved).toBe(true);
    expect(saved.properties.kind).toBe('place');
    expect(cluster.properties.saved).toBe(false);
  });

  it('updates saved state when the same canonical place is unsaved', () => {
    const previous = discoveryToMapFeatureCollection([SAVED_PLACE]);
    const next = updateMapFeatureCollection(
      [SAVED_PLACE],
      previous,
      [UNSAVED_PLACE],
    );

    expect(previous.features[0]?.properties.saved).toBe(true);
    expect(next.features[0]?.properties.saved).toBe(false);
    expect(next.features[0]?.id).toBe('place:place-1');
  });
});
