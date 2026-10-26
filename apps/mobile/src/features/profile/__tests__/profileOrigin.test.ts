import {
  clampBirthDate,
  getBirthDateBounds,
  parseCitySuggestions,
  parseIsoDate,
  toIsoDate,
} from '../profileOrigin';

describe('profile origin helpers', () => {
  it('round-trips a valid ISO birth date without timezone drift', () => {
    const parsed = parseIsoDate('1988-10-26');

    expect(parsed).not.toBeNull();
    expect(parsed ? toIsoDate(parsed) : null).toBe('1988-10-26');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseIsoDate('2000-02-30')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });

  it('builds deterministic 18-100 age bounds', () => {
    const now = new Date(2026, 9, 26);
    const bounds = getBirthDateBounds(now);

    expect(toIsoDate(bounds.maxDate)).toBe('2008-10-26');
    expect(toIsoDate(bounds.minDate)).toBe('1926-10-26');
    expect(toIsoDate(bounds.defaultDate)).toBe('2001-10-26');
  });

  it('clamps future-underage dates to the latest allowed birthday', () => {
    const now = new Date(2026, 9, 26);
    const clamped = clampBirthDate(new Date(2012, 0, 1), now);

    expect(toIsoDate(clamped)).toBe('2008-10-26');
  });

  it('normalizes and deduplicates MapTiler city suggestions', () => {
    const payload = {
      features: [
        {
          id: 'municipality.varna',
          text: 'Varna',
          place_name: 'Varna, Varna, Bulgaria',
          properties: { country_code: 'bg' },
          context: [{ id: 'country.bg', text: 'Bulgaria' }],
        },
        {
          id: 'place.varna-duplicate',
          text: 'Varna',
          place_name: 'Varna, Bulgaria',
          properties: { country_code: 'bg' },
          context: [{ id: 'country.bg', text: 'Bulgaria' }],
        },
      ],
    };

    expect(parseCitySuggestions(payload)).toEqual([
      {
        id: 'municipality.varna',
        city: 'Varna',
        countryCode: 'BG',
        countryName: 'Bulgaria',
        label: 'Varna, Varna, Bulgaria',
      },
    ]);
  });
});
