import { darkColors, lightColors } from '@/theme/colors';

import { resolveWorldModeVisuals, type WorldModeVisualInput } from './worldModeVisuals';

function sample(overrides: Partial<WorldModeVisualInput> = {}): WorldModeVisualInput {
  return {
    id: 'sanctuary',
    ownerId: 'user-a',
    userId: 'user-a',
    hydrated: true,
    enabled: true,
    scheme: 'dark',
    colors: darkColors,
    ...overrides,
  };
}

describe('World Mode decorative visuals', () => {
  it('applies the selected palette for the hydrated account', () => {
    const visuals = resolveWorldModeVisuals(sample());
    expect(visuals.id).toBe('sanctuary');
    expect(visuals.accent).toBe('#8CE8C4');
    expect(visuals.active).toBe(true);
  });

  it.each([
    ['feature disabled', { enabled: false }],
    ['signed out', { userId: null }],
    ['different account', { userId: 'user-b' }],
    ['not hydrated', { hydrated: false }],
    ['light appearance', { scheme: 'light', colors: lightColors }],
  ] as const)('falls back to semantic colors for %s', (_label, patch) => {
    const input = sample(patch);
    const visuals = resolveWorldModeVisuals(input);
    expect(visuals.active).toBe(false);
    expect(visuals.id).toBeNull();
    expect(visuals.accent).toBe(input.colors.actionPrimary);
    expect(visuals.glow).toBe(input.colors.actionGhost);
  });

  it('exposes decorative tokens only, never trust or status overrides', () => {
    const visuals = resolveWorldModeVisuals(sample({ id: 'vanguard' }));
    expect(Object.keys(visuals).sort()).toEqual(['accent', 'active', 'glow', 'id']);
  });
});
