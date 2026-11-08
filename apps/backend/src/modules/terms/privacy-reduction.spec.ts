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

  it.each([
    [{ status: 'active' }],
    [{ status: 'withdrawn', description: 'New ad' }],
    [{ status: 'accepted' }],
    [{ status: 'declined', note: 'A new post' }],
    [{ status: 'withdrawn', __proto__: { hidden: 1 } }],
    [[]], [null], [{}],
  ])('rejects non-exit actions or unsafe shapes: %p', input => {
    expect(isSafeExitOnly(input, withdraw)).toBe(false);
    if (typeof input !== 'object' || !input || Array.isArray(input) ||
      Object.keys(input).length !== 1 || 'status' in input && input.status !== 'declined') {
      expect(isSafeExitOnly(input, decline)).toBe(false);
    }
  });
});
