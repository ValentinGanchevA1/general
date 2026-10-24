import {
  NEXA_ENTITY_IDENTITY_KINDS,
  nexaEntityIdentityKindFromEntityKind,
  resolveNexaEntityIdentity,
} from './nexaEntityIdentity';

describe('NEXA entity identity contract', () => {
  it('locks the final entity family order', () => {
    expect(NEXA_ENTITY_IDENTITY_KINDS).toEqual([
      'person',
      'event',
      'listing',
      'opportunity',
    ]);
  });

  it('maps every family to the final canonical geometry', () => {
    expect(resolveNexaEntityIdentity('person').shape).toBe('circle');
    expect(resolveNexaEntityIdentity('event').shape).toBe('star');
    expect(resolveNexaEntityIdentity('listing').shape).toBe('square');
    expect(resolveNexaEntityIdentity('opportunity').shape).toBe('diamond');
  });

  it('keeps semantic tones aligned with product intent', () => {
    expect(resolveNexaEntityIdentity('person').tone).toBe('action');
    expect(resolveNexaEntityIdentity('event').tone).toBe('discovery');
    expect(resolveNexaEntityIdentity('listing').tone).toBe('neutral');
    expect(resolveNexaEntityIdentity('opportunity').tone).toBe('opportunity');
  });

  it('maps the current shared discovery DTO without inventing opportunity', () => {
    expect(nexaEntityIdentityKindFromEntityKind('user')).toBe('person');
    expect(nexaEntityIdentityKindFromEntityKind('event')).toBe('event');
    expect(nexaEntityIdentityKindFromEntityKind('listing')).toBe('listing');
  });
});
