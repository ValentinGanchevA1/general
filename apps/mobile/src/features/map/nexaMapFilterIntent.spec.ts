import type { MapManualFilterValues } from './nexaMapFilterIntent';
import { hasManualMapFilterChanges } from './nexaMapFilterIntent';

const defaults: MapManualFilterValues = {
  activeLens: 'map',
  defaultLayers: ['user'],
  customLayers: ['user'],
  listingModeFilter: 'all',
  friendsOnly: false,
  datingOnly: false,
  rankBy: 'relevance',
  searchQuery: '',
  marketplaceKind: 'all',
  // Matches publicPlacesMapLayerStore: public places are enabled by default.
  publicPlacesVisible: true,
  savedPlacesVisible: false,
};

describe('Map manual filter guard used by World Fusion', () => {
  it('allows default Map settings including enabled-by-default public Places', () => {
    expect(hasManualMapFilterChanges(defaults)).toBe(false);
  });

  it.each([
    ['custom spatial lens', { activeLens: 'custom' }],
    ['changed entity layers', { customLayers: ['event'] }],
    ['additional entity layer', { customLayers: ['user', 'event'] }],
    ['listing mode', { listingModeFilter: 'sell' }],
    ['friend-only discovery', { friendsOnly: true }],
    ['dating-only discovery', { datingOnly: true }],
    ['distance sorting', { rankBy: 'distance' }],
    ['search text', { searchQuery: 'local event' }],
    ['marketplace-kind selection', { marketplaceKind: 'service' }],
    ['explicitly disabled public Places', { publicPlacesVisible: false }],
    ['enabled saved Places overlay', { savedPlacesVisible: true }],
  ] as const)('blocks explicit %s', (_label, patch) => {
    const changed = { ...defaults, ...patch } as MapManualFilterValues;
    expect(hasManualMapFilterChanges(changed)).toBe(true);
  });

  it('ignores whitespace-only search and matches default layers regardless of order', () => {
    expect(hasManualMapFilterChanges({
      ...defaults,
      searchQuery: '   ',
    })).toBe(false);
    expect(hasManualMapFilterChanges({
      ...defaults,
      defaultLayers: ['user', 'listing'],
      customLayers: ['listing', 'user'],
    })).toBe(false);
  });
});
