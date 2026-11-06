import { worldModePalettes } from '@/theme/worldModePalettes';

import {
  createWorldFusionPreference,
  isValidFusionWorld,
  resolveWorldFusionPreview,
} from './worldFusion';

describe('NEXA World Fusion core', () => {
  it('combines a visual World with a secondary discovery World without changing identity', () => {
    const preference = createWorldFusionPreference('sanctuary', 'nocturne');
    const preview = resolveWorldFusionPreview(preference, {
      currentLens: 'map',
      hasExplicitMapFilters: false,
    });

    expect(preview.preference).toEqual({
      appearanceWorld: 'sanctuary',
      discoveryWorld: 'nocturne',
    });
    expect(preview.appearance).toEqual(worldModePalettes.sanctuary);
    expect(preview.suggestedLens).toBe('experiences');
    expect(preview.currentLens).toBe('map');
    expect(preview.canOfferLensChange).toBe(true);
    expect(preview.needsExplicitConfirmation).toBe(true);
  });

  it('never overwrites a manually selected lens or explicit filters', () => {
    const preference = createWorldFusionPreference('nexus', 'bazaar');
    for (const context of [
      { currentLens: 'custom' as const, hasExplicitMapFilters: true },
      { currentLens: 'map' as const, hasExplicitMapFilters: true },
      { currentLens: 'experiences' as const, hasExplicitMapFilters: false },
      { currentLens: 'opportunities' as const, hasExplicitMapFilters: false },
    ]) {
      const preview = resolveWorldFusionPreview(preference, context);
      expect(preview.currentLens).toBe(context.currentLens);
      expect(preview.suggestedLens).toBe('opportunities');
      expect(preview.canOfferLensChange).toBe(false);
    }
  });

  it('supports World pairs with no fabricated discovery implementation', () => {
    for (const world of ['sanctuary', 'profiler', 'pathfinder', 'vanguard'] as const) {
      const preference = createWorldFusionPreference('noir', world);
      const preview = resolveWorldFusionPreview(preference, {
        currentLens: 'map',
        hasExplicitMapFilters: false,
      });
      expect(preview.suggestedLens).toBeNull();
      expect(preview.canOfferLensChange).toBe(false);
    }
  });

  it('suggests only supported existing lenses', () => {
    const cases = [
      { world: 'nocturne' as const, lens: 'experiences' },
      { world: 'architect' as const, lens: 'experiences' },
      { world: 'bazaar' as const, lens: 'opportunities' },
    ];
    for (const item of cases) {
      const preview = resolveWorldFusionPreview(
        createWorldFusionPreference('nexus', item.world),
        { currentLens: 'map', hasExplicitMapFilters: false },
      );
      expect(preview.suggestedLens).toBe(item.lens);
    }
  });

  it('treats the same World twice or removal as a single-World experience', () => {
    const same = createWorldFusionPreference('sanctuary', 'sanctuary');
    expect(same.discoveryWorld).toBeNull();
    const removed = createWorldFusionPreference('sanctuary', null);
    expect(removed).toEqual(same);
    expect(resolveWorldFusionPreview(removed, {
      currentLens: 'map',
      hasExplicitMapFilters: false,
    }).suggestedLens).toBeNull();
  });

  it('rejects invalid, prototype-pollution and old premium IDs', () => {
    for (const value of ['__proto__', 'constructor', 'protos-nexus', '', null, {}, 123]) {
      expect(isValidFusionWorld(value)).toBe(false);
    }
    expect(isValidFusionWorld('bazaar')).toBe(true);
  });
});
