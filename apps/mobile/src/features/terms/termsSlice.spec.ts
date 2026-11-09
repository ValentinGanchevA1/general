import type { AcceptTermsRequest, TermsStatusResponse } from '@g88/shared';
import { sessionEnded } from '@/features/auth/authSlice';
import reducer, { acceptTerms, loadTermsStatus } from './termsSlice';

const required: TermsStatusResponse = {
  configured: true, enforcementEnabled: true, accepted: false, required: true,
  version: '2026-11-v1', url: 'https://g88-legal.onrender.com/terms',
};
const agreement: AcceptTermsRequest = {
  version: '2026-11-v1', accepted: true, channel: 'mobile',
};

describe('Terms Redux request correlation and session isolation', () => {
  it('ignores an older status response after a newer foreground refresh', () => {
    let state = reducer(undefined, loadTermsStatus.pending('first', undefined));
    state = reducer(state, loadTermsStatus.pending('second', undefined));
    state = reducer(state, loadTermsStatus.fulfilled({
      ...required, accepted: true, required: false,
    }, 'first', undefined));
    expect(state.loading).toBe(true);
    expect(state.status).toBeNull();
    state = reducer(state, loadTermsStatus.fulfilled(required, 'second', undefined));
    expect(state.loading).toBe(false);
    expect(state.status).toEqual(required);
  });

  it('never restores a previous account status after session end', () => {
    let state = reducer(undefined, loadTermsStatus.pending('former-user', undefined));
    state = reducer(state, sessionEnded());
    state = reducer(state, loadTermsStatus.fulfilled(required, 'former-user', undefined));
    expect(state.status).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.statusRequestId).toBeNull();
  });

  it('prevents an obsolete acceptance response from clearing another user’s consent gate', () => {
    let state = reducer(undefined, loadTermsStatus.pending('status', undefined));
    state = reducer(state, loadTermsStatus.fulfilled(required, 'status', undefined));
    state = reducer(state, acceptTerms.pending('old-accept', agreement));
    state = reducer(state, sessionEnded());

    state = reducer(state, loadTermsStatus.pending('new-user-status', undefined));
    state = reducer(state, loadTermsStatus.fulfilled(required, 'new-user-status', undefined));
    state = reducer(state, acceptTerms.fulfilled({
      accepted: true, version: agreement.version, acceptedAt: '2026-11-08T07:00:00Z',
    }, 'old-accept', agreement));

    expect(state.status?.required).toBe(true);
    expect(state.status?.accepted).toBe(false);
    expect(state.submitting).toBe(false);
  });

  it('clears the lock only when the matching acceptance succeeds', () => {
    let state = reducer(undefined, loadTermsStatus.pending('status', undefined));
    state = reducer(state, loadTermsStatus.fulfilled(required, 'status', undefined));
    state = reducer(state, acceptTerms.pending('accept', agreement));
    state = reducer(state, acceptTerms.fulfilled({
      accepted: true, version: agreement.version, acceptedAt: '2026-11-08T07:00:00Z',
    }, 'accept', agreement));
    expect(state.status?.accepted).toBe(true);
    expect(state.status?.required).toBe(false);
    expect(state.acceptRequestId).toBeNull();
  });
});
