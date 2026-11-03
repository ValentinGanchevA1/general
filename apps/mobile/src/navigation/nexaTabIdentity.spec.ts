import {
  NEXA_MAIN_TAB_ORDER,
  NEXA_TAB_VISUALS,
  isNexaMainTab,
  isNexaTabSelected,
  resolveConnectionsTabBadge,
} from './nexaTabIdentity';

describe('NEXA map-first navigation v3', () => {
  it('exposes five purpose-driven primary destinations in order', () => {
    expect(NEXA_MAIN_TAB_ORDER).toEqual([
      'Map', 'Experiences', 'Opportunities', 'Connections', 'Identity',
    ]);
    expect(Object.keys(NEXA_TAB_VISUALS)).toEqual(NEXA_MAIN_TAB_ORDER);
  });

  it('keeps old route identifiers outside visible navigation', () => {
    expect(isNexaMainTab('Pulse')).toBe(false);
    expect(isNexaMainTab('Discover')).toBe(false);
    expect(isNexaMainTab('You')).toBe(false);
    expect(isNexaMainTab('Identity')).toBe(true);
  });

  it('identifies spatial lenses and private destinations with semantic tones', () => {
    expect(NEXA_TAB_VISUALS.Map.tone).toBe('discovery');
    expect(NEXA_TAB_VISUALS.Experiences.tone).toBe('discovery');
    expect(NEXA_TAB_VISUALS.Opportunities.tone).toBe('discovery');
    expect(NEXA_TAB_VISUALS.Connections.tone).toBe('action');
    expect(NEXA_TAB_VISUALS.Identity.tone).toBe('action');
  });

  it('exposes the selected spatial lens to icons and screen readers', () => {
    expect(isNexaTabSelected('Map', 'map', true, true)).toBe(true);
    expect(isNexaTabSelected('Map', 'experiences', true, true)).toBe(false);
    expect(isNexaTabSelected('Experiences', 'experiences', true, false)).toBe(true);
    expect(isNexaTabSelected('Opportunities', 'opportunities', true, false)).toBe(true);
    expect(isNexaTabSelected('Opportunities', 'opportunities', false, false)).toBe(false);
    expect(isNexaTabSelected('Identity', 'experiences', false, true)).toBe(true);
  });

  it('limits Connections badges to actionable counts', () => {
    expect(resolveConnectionsTabBadge(0, 0)).toBeUndefined();
    expect(resolveConnectionsTabBadge(3, 2)).toBe(5);
    expect(resolveConnectionsTabBadge(120, 0)).toBe('99+');
    expect(resolveConnectionsTabBadge(-2, 1)).toBe(1);
    expect(resolveConnectionsTabBadge(-2, -1)).toBeUndefined();
  });
});
