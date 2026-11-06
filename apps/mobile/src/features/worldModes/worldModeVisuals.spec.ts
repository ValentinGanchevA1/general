import { darkColors, lightColors } from '@/theme/colors';

import { resolveWorldModeVisuals, type WorldModeVisualInput } from './worldModeVisuals';

function sample(overrides: Partial<WorldModeVisualInput> = {}): WorldModeVisualInput {
  return {
    id: 'sanctuary',
    ownerId: 'one',
    userId: 'one',
    hydrated: true,
    enabled: true,
    scheme: 'dark',
    colors: darkColors,
    ...overrides,
  };
}

describe('World Mode decorative visuals', () => {
  it('applies the mode palette for a hydrated current account', () => {
    const v = resolveWorldModeVisuals(sample());
    expect(v.id).toBe('sanctuary');
    expect(v.accent).toBe('#8CE8C4');
    expect(v.active).toBe(true);
  });

  it.each([
    ['disabled feature', { enabled: false }],
    ['signed out', { userId: null }],
    ['wrong account', { userId: 'two' }],
    ['not hydrated', { hydrated: false }],
    ['light appearance', { scheme: 'light', colors: lightColors }],
  ] as const)('preserves the existing theme in %s', (_name, patch) => {
    const input = sample(patch);
    const v = resolveWorldModeVisuals(input);
    expect(v.active).toBe(false);
    expect(v.id).toBeNull();
    expect(v.accent).toBe(input.colors.actionPrimary);
    expect(v.glow).toBe(input.colors.actionGhost);
  });

  it('never returns semantic status or trust overrides', () => {
    const visuals = resolveWorldModeVisuals(sample({ id: 'vanguard' }));
    expect(Object.keys(visuals).sort()).toEqual(['accent', 'active', 'glow', 'id']);
  });
});