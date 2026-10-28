import {
  NEXA_ENTITY_IDENTITY_KINDS,
  nexaEntityIdentityKindFromEntityKind,
  resolveNexaEntityIdentity,
} from './nexaEntityIdentity';

describe('NEXA entity identity contract', () => {
  it('locks the entity family order', () => {
    expect(NEXA_ENTITY_IDENTITY_KINDS).toEqual([
      'person',
      'event',
      'listing',
      'place',
      'opportunity',
    ]);
  });

  it('maps every family to canonical geometry', () => {
    expect(resolveNexaEntityIdentity('person').shape).toBe('circle');
    expect(resolveNexaEntityIdentity('event').shape).toBe('star');
    expect(resolveNexaEntityIdentity('listing').shape).toBe('square');
    expect(resolveNexaEntityIdentity('place').shape).toBe('diamond');
    expect(resolveNexaEntityIdentity('opportunity').shape).toBe('diamond');
  });

  it('keeps semantic tones aligned with product intent', () => {
    expect(resolveNexaEntityIdentity('person').tone).toBe('action');
    expect(resolveNexaEntityIdentity('event').tone).toBe('discovery');
    expect(resolveNexaEntityIdentity('listing').tone).toBe('neutral');
    expect(resolveNexaEntityIdentity('place').tone).toBe('discovery');
    expect(resolveNexaEntityIdentity('opportunity').tone).toBe('opportunity');
  });

  it('maps map discovery kinds without inventing opportunity', () => {
    expect(nexaEntityIdentityKindFromEntityKind('user')).toBe('person');
    expect(nexaEntityIdentityKindFromEntityKind('event')).toBe('event');
    expect(nexaEntityIdentityKindFromEntityKind('listing')).toBe('listing');
    expect(nexaEntityIdentityKindFromEntityKind('place')).toBe('place');
  });
});
