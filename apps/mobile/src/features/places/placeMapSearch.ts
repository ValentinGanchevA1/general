export const PLACE_MAP_SEARCH_MAX_LENGTH = 80;

export function normalizePlaceMapSearch(query: string): string {
  return query.trim().slice(0, PLACE_MAP_SEARCH_MAX_LENGTH).toLocaleLowerCase();
}

export function placeLabelMatchesMapSearch(
  canonicalLabel: string,
  normalizedQuery: string,
): boolean {
  return normalizedQuery === '' || canonicalLabel.toLocaleLowerCase().includes(normalizedQuery);
}
