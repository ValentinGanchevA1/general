import { canContinueWithTerms } from './termsAcceptanceSlice';

describe('canContinueWithTerms', () => {
  it('requires the current session and server-confirmed Terms status', () => {
    expect(canContinueWithTerms('user-1', { userId: 'user-1', phase: 'accepted' })).toBe(true);
    expect(canContinueWithTerms('user-1', { userId: 'user-1', phase: 'notRequired' })).toBe(true);
    expect(canContinueWithTerms('user-1', { userId: 'user-1', phase: 'required' })).toBe(false);
    expect(canContinueWithTerms('user-1', { userId: 'user-2', phase: 'accepted' })).toBe(false);
    expect(canContinueWithTerms(null, { userId: null, phase: 'notRequired' })).toBe(false);
  });
});
