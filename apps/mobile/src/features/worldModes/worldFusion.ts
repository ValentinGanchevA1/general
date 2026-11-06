import type { NexaSpatialLens } from '@/features/map/nexaSpatialLens.store';
import { worldModePalettes, type WorldModePalette } from '@/theme/worldModePalettes';

import { isWorldModeId, type WorldModeId } from './worldModes';

/**
 * World A controls decorative appearance. World B only *suggests* a discovery
 * intent. Neither choice changes identity, permissions, visibility, friends,
 * event authorization or the current map camera.
 */
export type WorldFusionPreference = Readonly<{
  appearanceWorld: WorldModeId;
  discoveryWorld: WorldModeId | null;
}>;

export type WorldFusionContext = Readonly<{
  currentLens: NexaSpatialLens;
  hasExplicitMapFilters: boolean;
}>;

export type WorldFusionPreview = Readonly<{
  preference: WorldFusionPreference;
  appearance: WorldModePalette;
  currentLens: NexaSpatialLens;
  suggestedLens: 'experiences' | 'opportunities' | null;
  canOfferLensChange: boolean;
  needsExplicitConfirmation: true;
}>;

/**
 * Only supported existing spatial lenses are suggested here.
 * Nocturne/Architect -> Experiences, Bazaar -> Opportunities.
 * Pathfinder/Sanctuary and other Worlds need a dedicated, reviewed filter
 * model before we can advertise a specific places/people/challenges layer.
 */
const SUPPORTED_WORLD_LENS_HINTS: Readonly<
  Partial<Record<WorldModeId, 'experiences' | 'opportunities'>>
> = {
  nocturne: 'experiences',
  architect: 'experiences',
  bazaar: 'opportunities',
};

/** Validate input at data boundaries; never trust arbitrary stored JSON. */
export function isValidFusionWorld(value: unknown): value is WorldModeId {
  return isWorldModeId(value);
}

/** Choosing the same World twice disables the secondary influence. */
export function createWorldFusionPreference(
  appearanceWorld: WorldModeId,
  discoveryWorld: WorldModeId | null,
): WorldFusionPreference {
  return {
    appearanceWorld,
    discoveryWorld: discoveryWorld === appearanceWorld ? null : discoveryWorld,
  };
}

export function resolveWorldFusionPreview(
  preference: WorldFusionPreference,
  context: WorldFusionContext,
): WorldFusionPreview {
  const suggestedLens = preference.discoveryWorld == null
    ? null
    : (SUPPORTED_WORLD_LENS_HINTS[preference.discoveryWorld] ?? null);

  // A World must never silently override the tab's spatial lens or an
  // explicitly chosen custom map filter. UI may offer an opt-in action later.
  const canOfferLensChange =
    suggestedLens != null &&
    context.currentLens === 'map' &&
    !context.hasExplicitMapFilters;

  return {
    preference,
    appearance: worldModePalettes[preference.appearanceWorld],
    currentLens: context.currentLens,
    suggestedLens,
    canOfferLensChange,
    needsExplicitConfirmation: true,
  };
}
