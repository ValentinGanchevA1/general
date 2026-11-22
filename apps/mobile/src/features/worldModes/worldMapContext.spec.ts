import { resolveWorldMapContext } from './worldMapContext';

describe('World map context aggregate (W2-7)', () => {
  it('aggregates presentation suggestions without changing authority', () => {
    const pathfinder = resolveWorldMapContext('pathfinder');
    expect(pathfinder.discoveryPreset?.lens).toBe('experiences');
    expect(pathfinder.spatialSuggestion?.lens).toBe('experiences');
    expect(pathfinder.actions.map((a) => a.id)).toContain('save-place');
  });

  it('keeps Bazaar suggestions aligned while preserving action-only affordances', () => {
    const bazaar = resolveWorldMapContext('bazaar');
    expect(bazaar.discoveryPreset?.lens).toBe('opportunities');
    expect(bazaar.spatialSuggestion?.lens).toBe('opportunities');
    expect(bazaar.actions.map((a) => a.id)).toContain('view-listing');
  });

  it('keeps presentation-only worlds and unmapped worlds safe', () => {
    for (const id of ['architect', 'diplomat', 'vanguard', 'sanctuary'] as const) {
      const context = resolveWorldMapContext(id);
      expect(context.discoveryPreset?.lens).toBe('map');
      expect(context.spatialSuggestion).toBeNull();
      expect(context.actions.length).toBeGreaterThan(0);
    }
    expect(resolveWorldMapContext('nexus').discoveryPreset).toBeNull();
    expect(resolveWorldMapContext('noir').actions).toEqual([]);
  });

  it('does not expose executable or authority-bearing controls', () => {
    const context = resolveWorldMapContext('bazaar');
    expect(context).not.toHaveProperty('query');
    expect(context).not.toHaveProperty('permissions');
    expect(context).not.toHaveProperty('ranking');
    expect(context).not.toHaveProperty('navigate');
    expect(context).not.toHaveProperty('execute');
  });
});
