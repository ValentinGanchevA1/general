import {
  CITY_OPTIONS,
  COUNTRY_OPTIONS,
  NATIONALITY_OPTIONS,
  countryName,
  resolveCountry,
} from './profileReferenceData';

describe('profileReferenceData', () => {
  it('normalizes country code and country name to the same option', () => {
    expect(resolveCountry('BG')).toMatchObject({ code: 'BG', name: 'Bulgaria', nationality: 'Bulgarian' });
    expect(resolveCountry('BULGARIA')).toMatchObject({ code: 'BG', name: 'Bulgaria' });
    expect(countryName('bg')).toBe('Bulgaria');
  });

  it('keeps launch-market Varna associated with Bulgaria', () => {
    expect(CITY_OPTIONS).toContainEqual({ city: 'Varna', countryCode: 'BG' });
  });

  it('exposes Bulgarian as a predefined nationality', () => {
    expect(NATIONALITY_OPTIONS).toContainEqual({ value: 'Bulgarian', label: 'Bulgarian', countryCode: 'BG' });
  });

  it('does not contain duplicate country codes', () => {
    const codes = COUNTRY_OPTIONS.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
