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
 * Decorative-only World accents. Require a hydrated owner match so a previous
 * account's preference can never flash while the next session is initializing.
 * Light appearance intentionally falls back until each palette is contrast-tested.
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
