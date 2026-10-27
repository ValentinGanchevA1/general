export interface CountryOption {
  code: string;
  name: string;
  nationality: string;
}

export interface CityOption {
  city: string;
  countryCode: string;
}

/**
 * Profile reference data intentionally stays local/offline.
 * Country values are stored as ISO 3166-1 alpha-2 codes while labels stay human readable.
 */
export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: 'AL', name: 'Albania', nationality: 'Albanian' },
  { code: 'AD', name: 'Andorra', nationality: 'Andorran' },
  { code: 'AR', name: 'Argentina', nationality: 'Argentinian' },
  { code: 'AM', name: 'Armenia', nationality: 'Armenian' },
  { code: 'AU', name: 'Australia', nationality: 'Australian' },
  { code: 'AT', name: 'Austria', nationality: 'Austrian' },
  { code: 'AZ', name: 'Azerbaijan', nationality: 'Azerbaijani' },
  { code: 'BE', name: 'Belgium', nationality: 'Belgian' },
  { code: 'BA', name: 'Bosnia and Herzegovina', nationality: 'Bosnian' },
  { code: 'BR', name: 'Brazil', nationality: 'Brazilian' },
  { code: 'BG', name: 'Bulgaria', nationality: 'Bulgarian' },
  { code: 'CA', name: 'Canada', nationality: 'Canadian' },
  { code: 'CL', name: 'Chile', nationality: 'Chilean' },
  { code: 'CN', name: 'China', nationality: 'Chinese' },
  { code: 'CO', name: 'Colombia', nationality: 'Colombian' },
  { code: 'HR', name: 'Croatia', nationality: 'Croatian' },
  { code: 'CY', name: 'Cyprus', nationality: 'Cypriot' },
  { code: 'CZ', name: 'Czechia', nationality: 'Czech' },
  { code: 'DK', name: 'Denmark', nationality: 'Danish' },
  { code: 'EE', name: 'Estonia', nationality: 'Estonian' },
  { code: 'FI', name: 'Finland', nationality: 'Finnish' },
  { code: 'FR', name: 'France', nationality: 'French' },
  { code: 'GE', name: 'Georgia', nationality: 'Georgian' },
  { code: 'DE', name: 'Germany', nationality: 'German' },
  { code: 'GR', name: 'Greece', nationality: 'Greek' },
  { code: 'HU', name: 'Hungary', nationality: 'Hungarian' },
  { code: 'IS', name: 'Iceland', nationality: 'Icelandic' },
  { code: 'IN', name: 'India', nationality: 'Indian' },
  { code: 'ID', name: 'Indonesia', nationality: 'Indonesian' },
  { code: 'IE', name: 'Ireland', nationality: 'Irish' },
  { code: 'IL', name: 'Israel', nationality: 'Israeli' },
  { code: 'IT', name: 'Italy', nationality: 'Italian' },
  { code: 'JP', name: 'Japan', nationality: 'Japanese' },
  { code: 'KZ', name: 'Kazakhstan', nationality: 'Kazakhstani' },
  { code: 'LV', name: 'Latvia', nationality: 'Latvian' },
  { code: 'LI', name: 'Liechtenstein', nationality: 'Liechtensteiner' },
  { code: 'LT', name: 'Lithuania', nationality: 'Lithuanian' },
  { code: 'LU', name: 'Luxembourg', nationality: 'Luxembourgish' },
  { code: 'MT', name: 'Malta', nationality: 'Maltese' },
  { code: 'MX', name: 'Mexico', nationality: 'Mexican' },
  { code: 'MD', name: 'Moldova', nationality: 'Moldovan' },
  { code: 'MC', name: 'Monaco', nationality: 'Monegasque' },
  { code: 'ME', name: 'Montenegro', nationality: 'Montenegrin' },
  { code: 'MA', name: 'Morocco', nationality: 'Moroccan' },
  { code: 'NL', name: 'Netherlands', nationality: 'Dutch' },
  { code: 'NZ', name: 'New Zealand', nationality: 'New Zealander' },
  { code: 'MK', name: 'North Macedonia', nationality: 'Macedonian' },
  { code: 'NO', name: 'Norway', nationality: 'Norwegian' },
  { code: 'PE', name: 'Peru', nationality: 'Peruvian' },
  { code: 'PH', name: 'Philippines', nationality: 'Filipino' },
  { code: 'PL', name: 'Poland', nationality: 'Polish' },
  { code: 'PT', name: 'Portugal', nationality: 'Portuguese' },
  { code: 'RO', name: 'Romania', nationality: 'Romanian' },
  { code: 'RS', name: 'Serbia', nationality: 'Serbian' },
  { code: 'SG', name: 'Singapore', nationality: 'Singaporean' },
  { code: 'SK', name: 'Slovakia', nationality: 'Slovak' },
  { code: 'SI', name: 'Slovenia', nationality: 'Slovenian' },
  { code: 'ZA', name: 'South Africa', nationality: 'South African' },
  { code: 'KR', name: 'South Korea', nationality: 'South Korean' },
  { code: 'ES', name: 'Spain', nationality: 'Spanish' },
  { code: 'SE', name: 'Sweden', nationality: 'Swedish' },
  { code: 'CH', name: 'Switzerland', nationality: 'Swiss' },
  { code: 'TH', name: 'Thailand', nationality: 'Thai' },
  { code: 'TR', name: 'Türkiye', nationality: 'Turkish' },
  { code: 'UA', name: 'Ukraine', nationality: 'Ukrainian' },
  { code: 'AE', name: 'United Arab Emirates', nationality: 'Emirati' },
  { code: 'GB', name: 'United Kingdom', nationality: 'British' },
  { code: 'US', name: 'United States', nationality: 'American' },
  { code: 'UY', name: 'Uruguay', nationality: 'Uruguayan' },
  { code: 'VN', name: 'Vietnam', nationality: 'Vietnamese' },
] as const;

/** Launch-market + common travel cities. Custom city entry remains supported. */
export const CITY_OPTIONS: readonly CityOption[] = [
  { city: 'Sofia', countryCode: 'BG' },
  { city: 'Varna', countryCode: 'BG' },
  { city: 'Plovdiv', countryCode: 'BG' },
  { city: 'Burgas', countryCode: 'BG' },
  { city: 'Ruse', countryCode: 'BG' },
  { city: 'Stara Zagora', countryCode: 'BG' },
  { city: 'Pleven', countryCode: 'BG' },
  { city: 'Sliven', countryCode: 'BG' },
  { city: 'Dobrich', countryCode: 'BG' },
  { city: 'Shumen', countryCode: 'BG' },
  { city: 'Pernik', countryCode: 'BG' },
  { city: 'Haskovo', countryCode: 'BG' },
  { city: 'Yambol', countryCode: 'BG' },
  { city: 'Pazardzhik', countryCode: 'BG' },
  { city: 'Blagoevgrad', countryCode: 'BG' },
  { city: 'Veliko Tarnovo', countryCode: 'BG' },
  { city: 'Vratsa', countryCode: 'BG' },
  { city: 'Gabrovo', countryCode: 'BG' },
  { city: 'Kazanlak', countryCode: 'BG' },
  { city: 'Vidin', countryCode: 'BG' },
  { city: 'Sandanski', countryCode: 'BG' },
  { city: 'Bansko', countryCode: 'BG' },
  { city: 'Nessebar', countryCode: 'BG' },
  { city: 'Balchik', countryCode: 'BG' },
  { city: 'Vienna', countryCode: 'AT' },
  { city: 'Brussels', countryCode: 'BE' },
  { city: 'Zagreb', countryCode: 'HR' },
  { city: 'Prague', countryCode: 'CZ' },
  { city: 'Copenhagen', countryCode: 'DK' },
  { city: 'Helsinki', countryCode: 'FI' },
  { city: 'Paris', countryCode: 'FR' },
  { city: 'Berlin', countryCode: 'DE' },
  { city: 'Munich', countryCode: 'DE' },
  { city: 'Athens', countryCode: 'GR' },
  { city: 'Budapest', countryCode: 'HU' },
  { city: 'Dublin', countryCode: 'IE' },
  { city: 'Rome', countryCode: 'IT' },
  { city: 'Milan', countryCode: 'IT' },
  { city: 'Amsterdam', countryCode: 'NL' },
  { city: 'Oslo', countryCode: 'NO' },
  { city: 'Warsaw', countryCode: 'PL' },
  { city: 'Lisbon', countryCode: 'PT' },
  { city: 'Bucharest', countryCode: 'RO' },
  { city: 'Belgrade', countryCode: 'RS' },
  { city: 'Bratislava', countryCode: 'SK' },
  { city: 'Ljubljana', countryCode: 'SI' },
  { city: 'Madrid', countryCode: 'ES' },
  { city: 'Barcelona', countryCode: 'ES' },
  { city: 'Stockholm', countryCode: 'SE' },
  { city: 'Zurich', countryCode: 'CH' },
  { city: 'Istanbul', countryCode: 'TR' },
  { city: 'Kyiv', countryCode: 'UA' },
  { city: 'London', countryCode: 'GB' },
  { city: 'New York', countryCode: 'US' },
  { city: 'Los Angeles', countryCode: 'US' },
  { city: 'Toronto', countryCode: 'CA' },
  { city: 'Vancouver', countryCode: 'CA' },
  { city: 'São Paulo', countryCode: 'BR' },
  { city: 'Rio de Janeiro', countryCode: 'BR' },
  { city: 'Buenos Aires', countryCode: 'AR' },
  { city: 'Tokyo', countryCode: 'JP' },
  { city: 'Seoul', countryCode: 'KR' },
  { city: 'Singapore', countryCode: 'SG' },
  { city: 'Dubai', countryCode: 'AE' },
  { city: 'Sydney', countryCode: 'AU' },
] as const;

export const NATIONALITY_OPTIONS = COUNTRY_OPTIONS
  .map((country) => ({ value: country.nationality, label: country.nationality, countryCode: country.code }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function resolveCountry(value: string | null | undefined): CountryOption | null {
  const normalized = value?.trim().toLocaleLowerCase();
  if (!normalized) return null;
  return COUNTRY_OPTIONS.find((country) =>
    country.code.toLocaleLowerCase() === normalized || country.name.toLocaleLowerCase() === normalized,
  ) ?? null;
}

export function countryName(value: string | null | undefined): string {
  return resolveCountry(value)?.name ?? value?.trim() ?? '';
}
