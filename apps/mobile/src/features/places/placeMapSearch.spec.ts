import {
  PLACE_MAP_SEARCH_MAX_LENGTH,
  normalizePlaceMapSearch,
  placeLabelMatchesMapSearch,
} from './placeMapSearch';

describe('placeMapSearch', () => {
  it('normalizes whitespace and case for map label search', () => {
    expect(normalizePlaceMapSearch('  Sea GARDEN  ')).toBe('sea garden');
  });

  it('bounds the Place lane to the backend query limit', () => {
    const query = 'A'.repeat(PLACE_MAP_SEARCH_MAX_LENGTH + 20);

    expect(normalizePlaceMapSearch(query)).toBe('a'.repeat(PLACE_MAP_SEARCH_MAX_LENGTH));
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
