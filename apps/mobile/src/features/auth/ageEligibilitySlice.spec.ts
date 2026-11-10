import ageEligibilityReducer, {
  checkAgeEligibility,
  completeAgeEligibility,
} from './ageEligibilitySlice';

const FIRST = '11111111-1111-1111-1111-111111111111';
const SECOND = '22222222-2222-2222-2222-222222222222';

describe('age eligibility state is fail-closed and session-scoped', () => {
  it('requires the server result before the app can become eligible', () => {
    const checking = ageEligibilityReducer(undefined, checkAgeEligibility.pending('check-1', FIRST));
    expect(checking).toMatchObject({ userId: FIRST, phase: 'checking', error: null });
    const required = ageEligibilityReducer(
      checking, checkAgeEligibility.fulfilled({ required: true, eligible: false }, 'check-1', FIRST),
    );
    expect(required).toMatchObject({ userId: FIRST, phase: 'required' });
    const completing = ageEligibilityReducer(
      required, completeAgeEligibility.pending('complete-1', { userId: FIRST, dateOfBirth: '2000-01-01' }),
    );
    expect(completing.phase).toBe('completing');
    const eligible = ageEligibilityReducer(
      completing,
      completeAgeEligibility.fulfilled(
        { required: true, eligible: true }, 'complete-1', { userId: FIRST, dateOfBirth: '2000-01-01' },
      ),
    );
    expect(eligible.phase).toBe('eligible');
  });

  it('rejects unknown status and never unlocks the app on network failure', () => {
    const checking = ageEligibilityReducer(undefined, checkAgeEligibility.pending('r1', FIRST));
    const failed = ageEligibilityReducer(
      checking, checkAgeEligibility.rejected(new Error('offline'), 'r1', FIRST, 'Network unavailable'),
    );
    expect(failed).toMatchObject({ phase: 'error', error: 'Network unavailable' });
    expect(failed.phase).not.toBe('eligible');
  });

  it('ignores stale status results from another session or superseded request', () => {
    const first = ageEligibilityReducer(undefined, checkAgeEligibility.pending('r1', FIRST));
    const second = ageEligibilityReducer(first, checkAgeEligibility.pending('r2', SECOND));
    const stale = ageEligibilityReducer(
      second, checkAgeEligibility.fulfilled({ required: false, eligible: true }, 'r1', FIRST),
    );
    expect(stale).toMatchObject({ userId: SECOND, phase: 'checking' });
    const newResult = ageEligibilityReducer(
      stale, checkAgeEligibility.fulfilled({ required: true, eligible: false }, 'r2', SECOND),
    );
    expect(newResult).toMatchObject({ userId: SECOND, phase: 'required' });
  });

  it('clears eligibility on logout, account switch and session restore', () => {
    const checked = ageEligibilityReducer(
      ageEligibilityReducer(undefined, checkAgeEligibility.pending('r', FIRST)),
      checkAgeEligibility.fulfilled({ required: false, eligible: true }, 'r', FIRST),
    );
    for (const type of [
      'auth/sessionEnded',
      'auth/logout/fulfilled',
      'auth/loginWithGoogle/fulfilled',
      'auth/restore/fulfilled',
      'auth/deleteAccount/fulfilled',
    ]) {
      const cleared = ageEligibilityReducer(checked, { type });
      expect(cleared).toMatchObject({ userId: null, phase: 'idle' });
    }
  });

  it('retains required gate after failed PATCH, enabling retry or logout', () => {
    const required = ageEligibilityReducer(
      ageEligibilityReducer(undefined, checkAgeEligibility.pending('r1', FIRST)),
      checkAgeEligibility.fulfilled({ required: true, eligible: false }, 'r1', FIRST),
    );
    const args = { userId: FIRST, dateOfBirth: '2000-01-01' };
    const submitting = ageEligibilityReducer(required, completeAgeEligibility.pending('r2', args));
    const failed = ageEligibilityReducer(
      submitting, completeAgeEligibility.rejected(new Error('DB error'), 'r2', args, 'Try again later'),
    );
    expect(failed).toMatchObject({ userId: FIRST, phase: 'required', error: 'Try again later' });
  });
});
