import type { MapEntityKind } from '@g88/shared';

export const NEXA_ENTITY_IDENTITY_KINDS = [
  'person',
  'event',
  'listing',
  'place',
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
  place: {
    kind: 'place',
    label: 'Place',
    shape: 'diamond',
    tone: 'discovery',
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

/** Map discovery adds place while opportunity remains a product-only identity. */
export function nexaEntityIdentityKindFromEntityKind(
  kind: MapEntityKind,
): Exclude<NexaEntityIdentityKind, 'opportunity'> {
  switch (kind) {
    case 'user':
      return 'person';
    case 'event':
      return 'event';
    case 'listing':
      return 'listing';
    case 'place':
      return 'place';
  }
}
