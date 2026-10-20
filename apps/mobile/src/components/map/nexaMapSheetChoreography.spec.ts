import type { EntityPoint } from '@g88/shared';
import type { Region } from 'react-native-maps';

import {
  NEXA_ENTITY_SHEET_SNAP_POINTS,
  entityPointKey,
  mapAnimationDuration,
  regionForSelectedEntity,
  resolveNexaSheetChoreography,
} from './nexaMapSheetChoreography';

const region: Region = {
  latitude: 42,
  longitude: 25,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const point = {
  kind: 'event',
  id: 'event-1',
  lat: 42.02,
  lng: 25.03,
  meta: {
    title: 'Nearby event',
    coverUrl: null,
    startsAt: '2026-10-20T18:00:00.000Z',
    attendeeCount: 0,
  },
} as EntityPoint;

describe('NEXA sheet ↔ map choreography', () => {
  it('keeps two semantic snap points', () => {
    expect(NEXA_ENTITY_SHEET_SNAP_POINTS).toEqual(['36%', '62%']);
    expect(resolveNexaSheetChoreography(0).sheetCoverage).toBe(0.36);
    expect(resolveNexaSheetChoreography(1).sheetCoverage).toBe(0.62);
  });

  it('moves the camera south so the selected entity appears above the sheet', () => {
    const compact = regionForSelectedEntity(region, point, 0);
    const expanded = regionForSelectedEntity(region, point, 1);

    expect(compact.longitude).toBe(point.lng);
    expect(compact.latitude).toBeLessThan(point.lat);
    expect(expanded.latitude).toBeLessThan(compact.latitude);
    expect(compact.latitudeDelta).toBe(region.latitudeDelta);
  });

  it('keeps marker selection keys deterministic', () => {
    expect(entityPointKey(point)).toBe('event:event-1');
  });

  it('removes camera animation when reduced motion is enabled', () => {
    expect(mapAnimationDuration(0, true)).toBe(0);
    expect(mapAnimationDuration(1, false)).toBeGreaterThan(0);
  });
});
