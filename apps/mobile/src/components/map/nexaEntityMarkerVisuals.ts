import {
  NEXA_ENTITY_IDENTITY_KINDS,
  resolveNexaEntityIdentity,
  type NexaEntityIdentityKind,
  type NexaEntityShape as NexaIdentityShape,
} from '@/product/nexaEntityIdentity';

export const NEXA_MARKER_TOUCH_SIZE = 44;

export const NEXA_MARKER_VISUAL_SIZE = {
  compact: 18,
  standard: 24,
  selected: 32,
} as const;

export type NexaMarkerDensity = keyof typeof NEXA_MARKER_VISUAL_SIZE;

export const NEXA_ENTITY_TYPES = NEXA_ENTITY_IDENTITY_KINDS;
export type NexaEntityType = NexaEntityIdentityKind;
export type NexaEntityShape = NexaIdentityShape;

export interface NexaMarkerState {
  selected?: boolean;
  live?: boolean;
  verified?: boolean;
  isNew?: boolean;
  own?: boolean;
  dimmed?: boolean;
  unavailable?: boolean;
}

export interface NexaMarkerVisualContract {
  entityType: NexaEntityType;
  shape: NexaEntityShape;
  visualSize: number;
  touchSize: number;
  opacity: number;
  showSelectedRing: boolean;
  showLiveRing: boolean;
  showVerifiedBadge: boolean;
  showNewDot: boolean;
  showOwnRing: boolean;
  showUnavailableSlash: boolean;
}

export function resolveNexaMarkerVisual(
  entityType: NexaEntityType,
  density: NexaMarkerDensity = 'standard',
  state: NexaMarkerState = {},
): NexaMarkerVisualContract {
  const visualSize = state.selected
    ? NEXA_MARKER_VISUAL_SIZE.selected
    : NEXA_MARKER_VISUAL_SIZE[density];

  const opacity = state.unavailable ? 0.35 : state.dimmed ? 0.42 : 1;

  return {
    entityType,
    shape: resolveNexaEntityIdentity(entityType).shape,
    visualSize,
    touchSize: NEXA_MARKER_TOUCH_SIZE,
    opacity,
    showSelectedRing: state.selected === true,
    showLiveRing: state.live === true,
    showVerifiedBadge: state.verified === true,
    showNewDot: state.isNew === true,
    showOwnRing: state.own === true,
    showUnavailableSlash: state.unavailable === true,
  };
}

export function diamondSideForBoundingSize(visualSize: number): number {
  return visualSize / Math.SQRT2;
}
