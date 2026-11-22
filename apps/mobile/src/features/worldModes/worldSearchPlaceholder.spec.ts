import { resolveWorldSearchPlaceholder } from './worldSearchPlaceholder';

describe('World-aware map search placeholder (W2-9)', () => {
  it.each([
    ['pathfinder', 'Search places'],
    ['nocturne', 'Search events and venues'],
    ['bazaar', 'Search listings'],
    ['architect', 'Search events'],
    ['diplomat', 'Search communities'],
    ['vanguard', 'Search challenges'],
    ['sanctuary', 'Search calm places'],
  ] as const)('uses contextual copy for %s', (worldId, expected) => {
    expect(resolveWorldSearchPlaceholder(worldId)).toBe(expected);
  });

  it.each(['nexus', 'noir', 'profiler'] as const)(
    'keeps a neutral hint for %s',
    (worldId) => expect(resolveWorldSearchPlaceholder(worldId)).toBe('Search nearby'),
  );

  it('falls back to a neutral hint when no account-scoped World is active', () => {
    expect(resolveWorldSearchPlaceholder(null)).toBe('Search nearby');
  });
});
