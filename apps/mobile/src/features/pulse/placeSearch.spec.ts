import * as h3 from 'h3-js';

import { parsePlaceSuggestions } from './placeSearch';

describe('parsePlaceSuggestions', () => {
  it('maps provider POIs to coarse provider-backed place identities', () => {
    const items = parsePlaceSuggestions({
      features: [{
        id: 'poi.sea-garden',
        text: 'Sea Garden',
        place_name: 'Sea Garden, Varna, Bulgaria',
        center: [27.9105, 43.2047],
      }],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      provider: 'maptiler',
      providerPlaceId: 'poi.sea-garden',
      canonicalLabel: 'Sea Garden',
      secondaryLabel: 'Sea Garden, Varna, Bulgaria',
      center: { lat: 43.2047, lng: 27.9105 },
    });
    expect(h3.isValidCell(items[0]!.providerCellH3R7)).toBe(true);
    expect(h3.getResolution(items[0]!.providerCellH3R7)).toBe(7);
  });

  it('dedupes provider IDs and ignores malformed results', () => {
    const items = parsePlaceSuggestions({
      features: [
        { id: 'poi.same', text: 'A', center: [27.9, 43.2] },
        { id: 'poi.same', text: 'Duplicate', center: [27.91, 43.21] },
        { id: 'poi.no-center', text: 'Missing center' },
        { id: '', text: 'Missing id', center: [27.9, 43.2] },
      ],
    });

    expect(items.map((item) => item.canonicalLabel)).toEqual(['A']);
  });
});
