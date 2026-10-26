import { Config } from '@/config';

export interface CitySuggestion {
  id: string;
  city: string;
  countryCode: string;
  countryName: string;
  label: string;
}

interface MapTilerFeature {
  id: string;
  text: string;
  placeName: string;
  countryCode: string;
  countryName: string;
}

const MIN_AGE = 18;
const MAX_AGE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readCountryName(context: unknown): string {
  if (!Array.isArray(context)) return '';

  for (const item of context) {
    if (!isRecord(item)) continue;
    const id = readString(item, 'id');
    if (!id.startsWith('country.')) continue;
    return readString(item, 'text');
  }

  return '';
}

function parseMapTilerFeature(value: unknown): MapTilerFeature | null {
  if (!isRecord(value)) return null;

  const id = readString(value, 'id');
  const text = readString(value, 'text');
  if (!id || !text) return null;

  const properties = isRecord(value.properties) ? value.properties : {};
  const countryCode = readString(properties, 'country_code').toUpperCase();
  const countryName = readCountryName(value.context) || countryCode;

  return {
    id,
    text,
    placeName: readString(value, 'place_name') || text,
    countryCode,
    countryName,
  };
}

export function parseCitySuggestions(payload: unknown): CitySuggestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.features)) return [];

  const seen = new Set<string>();
  const suggestions: CitySuggestion[] = [];

  for (const value of payload.features) {
    const feature = parseMapTilerFeature(value);
    if (!feature) continue;

    const dedupeKey = `${feature.text.toLocaleLowerCase()}|${feature.countryCode}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    suggestions.push({
      id: feature.id,
      city: feature.text,
      countryCode: feature.countryCode,
      countryName: feature.countryName,
      label: feature.placeName,
    });
  }

  return suggestions;
}

function mapTilerOrigin(): string {
  return Config.MAPTILER_REGION === 'eu'
    ? 'https://api.maptiler.eu'
    : 'https://api.maptiler.com';
}

export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const normalized = query.trim();
  if (normalized.length < 2 || !Config.MAPTILER_API_KEY) return [];

  const url =
    `${mapTilerOrigin()}/geocoding/${encodeURIComponent(normalized)}.json` +
    `?key=${encodeURIComponent(Config.MAPTILER_API_KEY)}` +
    '&autocomplete=true&limit=6&types=place,municipality,locality';

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('City suggestions are temporarily unavailable.');
  }

  const payload: unknown = await response.json();
  return parseCitySuggestions(payload);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getBirthDateBounds(now: Date = new Date()): {
  minDate: Date;
  maxDate: Date;
  defaultDate: Date;
} {
  const maxDate = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  const minDate = new Date(now.getFullYear() - MAX_AGE, now.getMonth(), now.getDate());
  const defaultDate = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());

  return { minDate, maxDate, defaultDate };
}

export function clampBirthDate(date: Date, now: Date = new Date()): Date {
  const { minDate, maxDate } = getBirthDateBounds(now);
  if (date.getTime() < minDate.getTime()) return minDate;
  if (date.getTime() > maxDate.getTime()) return maxDate;
  return date;
}
