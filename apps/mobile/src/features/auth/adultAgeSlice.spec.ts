import type { AdultAgeStatus } from '@g88/shared';
import { sessionEnded } from './authSlice';
import reducer, { loadAdultAgeStatus } from './adultAgeSlice';

const adult: AdultAgeStatus = { enforced: true, eligible: true, reason: null };
const missing: AdultAgeStatus = { enforced: true, eligible: false, reason: 'missing' };

describe('adult age Redux state isolation', () => {
  it('does not unlock another account using an old HTTP response', () => {
    let state = reducer(undefined, loadAdultAgeStatus.pending('req-a', 'account-a'));
    state = reducer(state, loadAdultAgeStatus.pending('req-b', 'account-b'));
    state = reducer(state, loadAdultAgeStatus.fulfilled(adult, 'req-a', 'account-a'));
    expect(state.userId).toBe('account-b');
    expect(state.status).toBeNull();
    state = reducer(state, loadAdultAgeStatus.fulfilled(missing, 'req-b', 'account-b'));
    expect(state.status).toEqual(missing);
  });

  it('invalidates in-flight eligibility after logout or deletion', () => {
    let state = reducer(undefined, loadAdultAgeStatus.pending('req', 'account-a'));
    state = reducer(state, sessionEnded());
    state = reducer(state, loadAdultAgeStatus.fulfilled(adult, 'req', 'account-a'));
    expect(state.userId).toBeNull();
    expect(state.status).toBeNull();
  });

  it('holds access closed when server verification fails', () => {
    let state = reducer(undefined, loadAdultAgeStatus.pending('r', 'account-a'));
    state = reducer(state, loadAdultAgeStatus.rejected({ name: 'Error', message: 'Network' }, 'r', 'account-a', 'Unable to check'));
    expect(state.status).toBeNull();
    expect(state.error).toBe('Unable to check');
    expect(state.loading).toBe(false);
  });
});
