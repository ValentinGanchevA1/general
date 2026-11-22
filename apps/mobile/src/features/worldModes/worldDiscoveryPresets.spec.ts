import { resolveWorldDiscoveryPreset } from './worldDiscoveryPresets';

describe('World discovery presets (W2-3)', () => {
  it('provides focused presets for mapped Worlds', () => {
    expect(resolveWorldDiscoveryPreset('pathfinder')?.lens).toBe('experiences');
    expect(resolveWorldDiscoveryPreset('nocturne')?.emphasis).toContain('events');
    expect(resolveWorldDiscoveryPreset('bazaar')?.lens).toBe('opportunities');
  });
  it('keeps supporting Worlds on the shared map lens', () => {
    for (const id of ['architect', 'diplomat', 'vanguard', 'sanctuary'] as const) {
      expect(resolveWorldDiscoveryPreset(id)?.lens).toBe('map');
    }
  });
  it('leaves Nexus and Noir without preset suggestions', () => {
    expect(resolveWorldDiscoveryPreset('nexus')).toBeNull();
    expect(resolveWorldDiscoveryPreset('noir')).toBeNull();
  });
  it('does not expose query, permission or ranking controls', () => {
    const preset = resolveWorldDiscoveryPreset('bazaar');
    expect(preset).not.toHaveProperty('query');
    expect(preset).not.toHaveProperty('permissions');
    expect(preset).not.toHaveProperty('ranking');
  });
});
