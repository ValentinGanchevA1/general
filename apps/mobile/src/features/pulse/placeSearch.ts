import {
  computeH3Cells,
  fuzzLocation,
  type LatLng,
  type PlaceSuggestion,
} from '@g88/shared';

import { Config } from '@/config';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readCenter(record: Record<string, unknown>): LatLng | null {
  const center = record.center;
  if (!Array.isArray(center) || center.length < 2) return null;
  const lng = center[0];
  const lat = center[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseSuggestion(value: unknown): PlaceSuggestion | null {
  if (!isRecord(value)) return null;
  const providerPlaceId = readString(value, 'id').trim();
  const canonicalLabel = readString(value, 'text').trim();
  const center = readCenter(value);
  if (!providerPlaceId || !canonicalLabel || !center) return null;

  const fullLabel = readString(value, 'place_name').trim();
  return {
    provider: 'maptiler',
    providerPlaceId,
    canonicalLabel,
    providerCellH3R7: computeH3Cells(center.lat, center.lng).r7,
    secondaryLabel: fullLabel && fullLabel !== canonicalLabel ? fullLabel : null,
    center,
  };
}

export function parsePlaceSuggestions(payload: unknown): PlaceSuggestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.features)) return [];
  const seen = new Set<string>();
  const result: PlaceSuggestion[] = [];

  for (const feature of payload.features) {
    const suggestion = parseSuggestion(feature);
    if (!suggestion || seen.has(suggestion.providerPlaceId)) continue;
    seen.add(suggestion.providerPlaceId);
    result.push(suggestion);
  }
  return result;
}

function mapTilerOrigin(): string {
  return Config.MAPTILER_REGION === 'eu'
    ? 'https://api.maptiler.eu'
    : 'https://api.maptiler.com';
}

export async function searchPlaces(
  query: string,
  proximity: LatLng | null,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const normalized = query.trim();
  if (normalized.length < 2 || !Config.MAPTILER_API_KEY) return [];

  const params = [
    `key=${encodeURIComponent(Config.MAPTILER_API_KEY)}`,
    'autocomplete=true',
    'limit=6',
    'types=poi,address,place',
  ];
  if (proximity) {
    const coarse = fuzzLocation(proximity, 7);
    params.push(`proximity=${encodeURIComponent(`${coarse.lng},${coarse.lat}`)}`);
  }

  const response = await fetch(
    `${mapTilerOrigin()}/geocoding/${encodeURIComponent(normalized)}.json?${params.join('&')}`,
    { signal },
  );
  if (!response.ok) throw new Error('Place suggestions are temporarily unavailable.');
  const payload: unknown = await response.json();
  return parsePlaceSuggestions(payload);
}
