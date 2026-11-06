import type { ThemeColors } from '@/theme/colors';
import { worldModePalettes } from '@/theme/worldModePalettes';

import type { WorldModeId } from './worldModes';

export interface WorldModeVisuals {
  readonly active: boolean;
  readonly id: WorldModeId | null;
  readonly accent: string;
  readonly glow: string;
}

export interface WorldModeVisualInput {
  readonly id: WorldModeId;
  readonly ownerId: string | null;
  readonly userId: string | null;
  readonly hydrated: boolean;
  readonly enabled: boolean;
  readonly scheme: 'light' | 'dark';
  readonly colors: ThemeColors;
}

/**
 * Strictly decorative color treatment. Never modify permissions, trust badges,
 * map layers, user visibility, status colors, purchase eligibility or navigation.
 *
 * Dark-only until every palette has independently validated light contrast.
 * The active account must match the preference owner (prevents account leaks).
 */
export function resolveWorldModeVisuals(input: WorldModeVisualInput): WorldModeVisuals {
  if (
    !input.enabled ||
    input.scheme !== 'dark' ||
    !input.hydrated ||
    !input.userId ||
    input.ownerId !== input.userId
  ) {
    return {
      active: false,
      id: null,
      accent: input.colors.actionPrimary,
      glow: input.colors.actionGhost,
    };
  }
  const palette = worldModePalettes[input.id];
  return {
    active: true,
    id: input.id,
    accent: palette.accent,
    glow: palette.glow,
  };
}