import { isPrivacyReductionOnly, isSafeExitOnly } from './privacy-reduction';

describe('privacy-reduction bypass', () => {
  it.each([
    [{ visibility: 'private' }],
    [{ friendsSeeOnlineStatus: false }],
    [{ showAge: false, showGender: false, showOrientation: false }],
    [{ openToDating: false }],
    [{ visibility: 'private', showHometown: false }],
  ])('allows only strictly privacy-reducing updates: %p', input => {
    expect(isPrivacyReductionOnly(input)).toBe(true);
  });

  it.each([
    [{ visibility: 'public' }],
    [{ showAge: true }],
    [{ displayName: 'An update' }],
    [{ bio: 'Content', visibility: 'private' }],
    [{ openToDating: true }],
    [{ visibility: 'private', avatarUrl: 'https://test.example/portrait.jpg' }],
    [{ showAge: null }],
    [{}], [null], [undefined], ['visibility'], ['private'],
  ])('denies arbitrary/expanding mutations: %p', input => {
    expect(isPrivacyReductionOnly(input)).toBe(false);
  });
});

describe('Terms safety exit exception', () => {
  const withdraw = { field: 'status' as const, value: 'withdrawn' as const };
  const decline = { field: 'status' as const, value: 'declined' as const };

  it('permits exact withdrawal or refusal of a pending interaction', () => {
    expect(isSafeExitOnly({ status: 'withdrawn' }, withdraw)).toBe(true);
    expect(isSafeExitOnly({ status: 'declined' }, decline)).toBe(true);
  });

  it('denies republishing, combined content edits and malformed body shapes', () => {
    const unsafeWithdrawals: unknown[] = [
      { status: 'active' },
      { status: 'withdrawn', description: 'Updated listing' },
      { status: 'accepted' },
      { status: 'declined' },
      { status: 'withdrawn', ['__proto__']: { hidden: 1 } },
      [], null, {},
    ];
    for (const input of unsafeWithdrawals) {
      expect(isSafeExitOnly(input, withdraw)).toBe(false);
    }
    const unsafeDeclines: unknown[] = [
      { status: 'accepted' },
      { status: 'declined', message: 'Extra content' },
      { status: 'withdrawn' },
      [], null, {},
    ];
    for (const input of unsafeDeclines) {
      expect(isSafeExitOnly(input, decline)).toBe(false);
    }
  });
});
