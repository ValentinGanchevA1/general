import type { ThemeColors } from '@/theme/colors';
import { worldModePalettes } from '@/theme/worldModePalettes';

import type { WorldModeId } from './worldModes';

export interface WorldModeVisuals {
  readonly active: boolean;
  /** Selected World is available for labels/chips even when its accent treatment is disabled. */
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
 * Decorative World accent resolver. Never changes semantic status, trust or
 * entitlement tokens. The selected identity is retained in Light appearance,
 * but all color treatment falls back to the current theme until contrast QA.
 * Account ownership is checked before exposing the selected ID.
 */
export function resolveWorldModeVisuals(input: WorldModeVisualInput): WorldModeVisuals {
  if (
    !input.enabled ||
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

  if (input.scheme === 'light') {
    return {
      active: false,
      id: input.id,
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
