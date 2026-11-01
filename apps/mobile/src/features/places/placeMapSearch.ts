export function normalizePlaceMapSearch(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export function placeLabelMatchesMapSearch(
  canonicalLabel: string,
  normalizedQuery: string,
): boolean {
  return normalizedQuery === '' || canonicalLabel.toLocaleLowerCase().includes(normalizedQuery);
}
