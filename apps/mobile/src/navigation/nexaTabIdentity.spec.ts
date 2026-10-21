import {
  NEXA_MAIN_TAB_ORDER,
  NEXA_TAB_VISUALS,
  resolveConnectionsTabBadge,
} from './nexaTabIdentity';

describe('NEXA main tab identity', () => {
  it('locks the canonical five-tab order', () => {
    expect(NEXA_MAIN_TAB_ORDER).toEqual([
      'Map',
      'Discover',
      'Pulse',
      'Connections',
      'You',
    ]);
  });

  it('uses discovery tone for spatial/live tabs and action tone for relationship/self tabs', () => {
    expect(NEXA_TAB_VISUALS.Map.tone).toBe('discovery');
    expect(NEXA_TAB_VISUALS.Discover.tone).toBe('discovery');
    expect(NEXA_TAB_VISUALS.Pulse.tone).toBe('discovery');
    expect(NEXA_TAB_VISUALS.Connections.tone).toBe('action');
    expect(NEXA_TAB_VISUALS.You.tone).toBe('action');
  });

  it('uses actionable counts only for the Connections badge', () => {
    expect(resolveConnectionsTabBadge(0, 0)).toBeUndefined();
    expect(resolveConnectionsTabBadge(3, 2)).toBe(5);
    expect(resolveConnectionsTabBadge(120, 0)).toBe('99+');
  });

  it('guards against negative upstream counts', () => {
    expect(resolveConnectionsTabBadge(-2, 1)).toBe(1);
    expect(resolveConnectionsTabBadge(-2, -1)).toBeUndefined();
  });
});
