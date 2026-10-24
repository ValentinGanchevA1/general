import type { EntityKind } from '@g88/shared';

import {
  nexaEntityIdentityKindFromEntityKind,
  resolveNexaEntityIdentity,
  type NexaEntityIdentityKind,
  type NexaEntityShape,
  type NexaEntityTone,
} from '@/product/nexaEntityIdentity';

export type NexaSpatialSheetKind = NexaEntityIdentityKind;
export type NexaSpatialSheetShape = NexaEntityShape;

export interface NexaSpatialSheetVisual {
  kind: NexaSpatialSheetKind;
  label: string;
  shape: NexaSpatialSheetShape;
  tone: NexaEntityTone;
  defaultPrimaryLabel: string;
}

const PRIMARY_LABEL_BY_KIND: Record<NexaSpatialSheetKind, string> = {
  person: 'Connect',
  event: 'Join',
  listing: 'View',
  opportunity: 'Explore',
};

export const NEXA_SPATIAL_SHEET_SNAP_POINTS = ['38%', '68%'] as const;

export function resolveNexaSpatialSheetVisual(
  kind: NexaSpatialSheetKind,
): NexaSpatialSheetVisual {
  const identity = resolveNexaEntityIdentity(kind);
  return {
    kind,
    label: identity.label,
    shape: identity.shape,
    tone: identity.tone,
    defaultPrimaryLabel: PRIMARY_LABEL_BY_KIND[kind],
  };
}

/**
 * Current discovery contract has user/event/listing only.
 * Opportunity stays presentational until it is introduced in @g88/shared.
 */
export function spatialSheetKindFromEntityKind(
  kind: EntityKind,
): Exclude<NexaSpatialSheetKind, 'opportunity'> {
  return nexaEntityIdentityKindFromEntityKind(kind);
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
