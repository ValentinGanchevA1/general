import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AgeCompletionRequest, AgeEligibilityStatus } from '@g88/shared';

import { getJson, patchJson } from '@/api/client';
import { extractMessage } from '@/utils/extractMessage';

export type AgeGatePhase = 'idle' | 'checking' | 'required' | 'completing' | 'eligible' | 'error';

interface AgeEligibilityState {
  userId: string | null;
  phase: AgeGatePhase;
  error: string | null;
  /** Guards against stale async responses after logout or switching accounts. */
  activeRequestId: string | null;
}

const initialState: AgeEligibilityState = {
  userId: null,
  phase: 'idle',
  error: null,
  activeRequestId: null,
};

/** Never reuse a prior account's eligibility when switching or restoring sessions. */
export function canEnterSocial(
  currentUserId: string | null,
  state: Pick<AgeEligibilityState, 'userId' | 'phase'>,
): boolean {
  return currentUserId !== null
    && state.userId === currentUserId
    && state.phase === 'eligible';
}

function verifiedStatus(status: AgeEligibilityStatus): AgeEligibilityStatus {
  if (typeof status.required !== 'boolean' || typeof status.eligible !== 'boolean') {
    throw new Error('Age eligibility status was unavailable.');
  }
  return status;
}

export const checkAgeEligibility = createAsyncThunk<
  AgeEligibilityStatus, string, { rejectValue: string }
>('ageEligibility/check', async (_userId, { rejectWithValue }) => {
  try {
    return verifiedStatus(await getJson<AgeEligibilityStatus>('/auth/age-eligibility'));
  } catch (error: unknown) {
    return rejectWithValue(extractMessage(error, 'Could not check age eligibility.'));
  }
});

export const completeAgeEligibility = createAsyncThunk<
  AgeEligibilityStatus, { userId: string; dateOfBirth: string }, { rejectValue: string }
>('ageEligibility/complete', async ({ dateOfBirth }, { rejectWithValue }) => {
  try {
    // The backend owns eligibility; never accept a client-side DOB calculation as proof.
    const body: AgeCompletionRequest = { dateOfBirth };
    const completed = await patchJson<AgeCompletionRequest, { eligible: true }>(
      '/auth/age-eligibility',
      body,
    );
    if (completed.eligible !== true) throw new Error('Age completion was not confirmed.');
    const confirmed = verifiedStatus(await getJson<AgeEligibilityStatus>('/auth/age-eligibility'));
    if (!confirmed.eligible) throw new Error('Age eligibility was not confirmed by the server.');
    return confirmed;
  } catch (error: unknown) {
    return rejectWithValue(extractMessage(error, 'Could not complete age eligibility.'));
  }
});

function forSession(state: AgeEligibilityState, userId: string, requestId: string, phase: AgeGatePhase): void {
  state.userId = userId;
  state.activeRequestId = requestId;
  state.phase = phase;
  state.error = null;
}

const ageEligibilitySlice = createSlice({
  name: 'ageEligibility',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkAgeEligibility.pending, (state, action) => {
        forSession(state, action.meta.arg, action.meta.requestId, 'checking');
      })
      .addCase(checkAgeEligibility.fulfilled, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
        state.activeRequestId = null;
        state.phase = action.payload.eligible ? 'eligible' : 'required';
        state.error = null;
      })
      .addCase(checkAgeEligibility.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
        state.activeRequestId = null;
        state.phase = 'error'; // Never show Main on a network/DB failure.
        state.error = action.payload ?? 'Could not check age eligibility.';
      })
      .addCase(completeAgeEligibility.pending, (state, action) => {
        forSession(state, action.meta.arg.userId, action.meta.requestId, 'completing');
      })
      .addCase(completeAgeEligibility.fulfilled, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId ||
            state.userId !== action.meta.arg.userId) return;
        state.activeRequestId = null;
        state.phase = action.payload.eligible ? 'eligible' : 'required';
      })
      .addCase(completeAgeEligibility.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId ||
            state.userId !== action.meta.arg.userId) return;
        state.activeRequestId = null;
        // Retry the DOB or use the status retry if patch outcome is uncertain.
        state.phase = 'required';
        state.error = action.payload ?? 'Could not complete age eligibility.';
      })
      .addMatcher(
        (action) => [
          'auth/sessionEnded',
          'auth/login/fulfilled',
          'auth/register/fulfilled',
          'auth/loginWithGoogle/fulfilled',
          'auth/restore/fulfilled',
          'auth/restore/rejected',
          'auth/logout/fulfilled',
          'auth/logout/rejected',
          'auth/deleteAccount/fulfilled',
        ].includes(action.type),
        () => initialState,
      );
  },
});

export default ageEligibilitySlice.reducer;
