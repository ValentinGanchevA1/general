import type { EntityKind } from '@g88/shared';

export const NEXA_ENTITY_IDENTITY_KINDS = [
  'person',
  'event',
  'listing',
  'opportunity',
] as const;

export type NexaEntityIdentityKind = (typeof NEXA_ENTITY_IDENTITY_KINDS)[number];
export type NexaEntityShape = 'circle' | 'star' | 'square' | 'diamond';
export type NexaEntityTone = 'action' | 'discovery' | 'neutral' | 'opportunity';

export interface NexaEntityIdentity {
  kind: NexaEntityIdentityKind;
  label: string;
  shape: NexaEntityShape;
  tone: NexaEntityTone;
}

const IDENTITY_BY_KIND: Record<NexaEntityIdentityKind, NexaEntityIdentity> = {
  person: {
    kind: 'person',
    label: 'Person',
    shape: 'circle',
    tone: 'action',
  },
  event: {
    kind: 'event',
    label: 'Event',
    shape: 'star',
    tone: 'discovery',
  },
  listing: {
    kind: 'listing',
    label: 'Listing',
    shape: 'square',
    tone: 'neutral',
  },
  opportunity: {
    kind: 'opportunity',
    label: 'Opportunity',
    shape: 'diamond',
    tone: 'opportunity',
  },
};

export function resolveNexaEntityIdentity(
  kind: NexaEntityIdentityKind,
): NexaEntityIdentity {
  return IDENTITY_BY_KIND[kind];
}

/**
 * The shared discovery DTO currently exposes user/event/listing.
 * Opportunity remains a product identity until the shared API contract adds it.
 */
export function nexaEntityIdentityKindFromEntityKind(
  kind: EntityKind,
): Exclude<NexaEntityIdentityKind, 'opportunity'> {
  switch (kind) {
    case 'user':
      return 'person';
    case 'event':
      return 'event';
    case 'listing':
      return 'listing';
  }
}
