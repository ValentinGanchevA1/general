import {
  compactSpatialMeta,
  formatNexaSpatialDistance,
  resolveNexaSpatialSheetVisual,
  spatialSheetKindFromEntityKind,
} from './nexaSpatialSheet';

describe('NEXA spatial sheet identity', () => {
  it('keeps canonical geometry for every entity family', () => {
    expect(resolveNexaSpatialSheetVisual('person').shape).toBe('circle');
    expect(resolveNexaSpatialSheetVisual('event').shape).toBe('diamond');
    expect(resolveNexaSpatialSheetVisual('listing').shape).toBe('square');
    expect(resolveNexaSpatialSheetVisual('opportunity').shape).toBe('star');
  });

  it('maps the current shared discovery contract without inventing opportunity DTOs', () => {
    expect(spatialSheetKindFromEntityKind('user')).toBe('person');
    expect(spatialSheetKindFromEntityKind('event')).toBe('event');
    expect(spatialSheetKindFromEntityKind('listing')).toBe('listing');
  });

  it('coarsens nearby distance instead of exposing precise meter proximity', () => {
    expect(formatNexaSpatialDistance(24)).toBe('Nearby');
    expect(formatNexaSpatialDistance(99)).toBe('Nearby');
    expect(formatNexaSpatialDistance(149)).toBe('~100 m');
    expect(formatNexaSpatialDistance(651)).toBe('~700 m');
    expect(formatNexaSpatialDistance(1450)).toBe('~1.5 km');
    expect(formatNexaSpatialDistance(12_200)).toBe('~12 km');
  });

  it('rejects invalid distance values', () => {
    expect(formatNexaSpatialDistance(null)).toBeNull();
    expect(formatNexaSpatialDistance(undefined)).toBeNull();
    expect(formatNexaSpatialDistance(-1)).toBeNull();
    expect(formatNexaSpatialDistance(Number.NaN)).toBeNull();
  });

  it('compacts optional spatial metadata', () => {
    expect(compactSpatialMeta(['Today 18:00', null, '', '450 m', undefined])).toEqual([
      'Today 18:00',
      '450 m',
    ]);
  });
});
