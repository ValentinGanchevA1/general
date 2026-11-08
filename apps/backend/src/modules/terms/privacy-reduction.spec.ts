import { isPrivacyReductionOnly } from './privacy-reduction';

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
