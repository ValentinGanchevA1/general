import {
  DARK_MAP_STYLE,
  LIGHT_MAP_STYLE,
  PROTOS_NEXUS_MAP_STYLE,
  resolveMapStyle,
} from '@/components/map/mapStyle';

describe('resolveMapStyle', () => {
  it('uses the exclusive NEXUS palette when NEXUS is the effective mode', () => {
    expect(resolveMapStyle('protos-nexus', 'dark')).toBe(PROTOS_NEXUS_MAP_STYLE);
  });

  it('keeps the standard dark palette unchanged', () => {
    expect(resolveMapStyle('dark', 'dark')).toBe(DARK_MAP_STYLE);
    expect(resolveMapStyle('system', 'dark')).toBe(DARK_MAP_STYLE);
  });

  it('keeps the standard light palette unchanged', () => {
    expect(resolveMapStyle('light', 'light')).toBe(LIGHT_MAP_STYLE);
    expect(resolveMapStyle('system', 'light')).toBe(LIGHT_MAP_STYLE);
  });
});
