import {
  normalizePlaceMapSearch,
  placeLabelMatchesMapSearch,
} from './placeMapSearch';

describe('placeMapSearch', () => {
  it('normalizes whitespace and case for map label search', () => {
    expect(normalizePlaceMapSearch('  Sea GARDEN  ')).toBe('sea garden');
  });

  it('matches canonical labels by normalized substring', () => {
    const query = normalizePlaceMapSearch('garden');

    expect(placeLabelMatchesMapSearch('Sea Garden', query)).toBe(true);
    expect(placeLabelMatchesMapSearch('City Park', query)).toBe(false);
  });

  it('keeps all private places visible for an empty search', () => {
    expect(placeLabelMatchesMapSearch('Sea Garden', '')).toBe(true);
  });
});
