import type { EntityKind } from '@g88/shared';

export type NexaSpatialSheetKind = 'person' | 'event' | 'listing' | 'opportunity';

export type NexaSpatialSheetShape = 'circle' | 'star' | 'square' | 'diamond';

export interface NexaSpatialSheetVisual {
  kind: NexaSpatialSheetKind;
  label: string;
  shape: NexaSpatialSheetShape;
  tone: 'action' | 'discovery' | 'neutral' | 'opportunity';
  defaultPrimaryLabel: string;
}

const VISUALS: Record<NexaSpatialSheetKind, NexaSpatialSheetVisual> = {
  person: {
    kind: 'person',
    label: 'Person',
    shape: 'circle',
    tone: 'action',
    defaultPrimaryLabel: 'Connect',
  },
  event: {
    kind: 'event',
    label: 'Event',
    shape: 'star',
    tone: 'discovery',
    defaultPrimaryLabel: 'Join',
  },
  listing: {
    kind: 'listing',
    label: 'Listing',
    shape: 'square',
    tone: 'neutral',
    defaultPrimaryLabel: 'View',
  },
  opportunity: {
    kind: 'opportunity',
    label: 'Opportunity',
    shape: 'diamond',
    tone: 'opportunity',
    defaultPrimaryLabel: 'Explore',
  },
};

export const NEXA_SPATIAL_SHEET_SNAP_POINTS = ['38%', '68%'] as const;

export function resolveNexaSpatialSheetVisual(
  kind: NexaSpatialSheetKind,
): NexaSpatialSheetVisual {
  return VISUALS[kind];
}

/**
 * Current discovery contract has user/event/listing only.
 * Opportunity stays presentational until it is introduced in @g88/shared.
 */
export function spatialSheetKindFromEntityKind(kind: EntityKind): Exclude<NexaSpatialSheetKind, 'opportunity'> {
  switch (kind) {
    case 'user':
      return 'person';
    case 'event':
      return 'event';
    case 'listing':
      return 'listing';
  }
}

/**
 * Privacy-safe display distance. Never exposes precise meter-level proximity for people.
 * It is intentionally coarser than the internal distance used for ranking and map logic.
 */
export function formatNexaSpatialDistance(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 100) return 'Nearby';
  if (meters < 1000) {
    const rounded = Math.max(100, Math.round(meters / 100) * 100);
    return `~${rounded} m`;
  }

  const km = meters / 1000;
  if (km < 10) return `~${(Math.round(km * 10) / 10).toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

export function compactSpatialMeta(parts: Array<string | null | undefined>): string[] {
  return parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
}
