import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AcceptUgcTermsRequest, UgcTermsAcceptanceStatus } from '@g88/shared';

import { getJson, postJson } from '@/api/client';
import { extractMessage } from '@/utils/extractMessage';

export type TermsAcceptancePhase =
  | 'idle' | 'checking' | 'required' | 'accepting' | 'accepted' | 'notRequired' | 'error';

interface TermsAcceptanceState extends UgcTermsAcceptanceStatus {
  userId: string | null;
  phase: TermsAcceptancePhase;
  error: string | null;
  activeRequestId: string | null;
  deferredForSession: boolean;
}

const initialState: TermsAcceptanceState = {
  userId: null,
  phase: 'idle',
  error: null,
  activeRequestId: null,
  deferredForSession: false,
  required: false,
  accepted: false,
  termsVersion: null,
  termsSha256: null,
  acceptedAt: null,
};

export function canContinueWithTerms(
  currentUserId: string | null,
  state: Pick<TermsAcceptanceState, 'userId' | 'phase'>,
): boolean {
  return currentUserId !== null
    && state.userId === currentUserId
    && (state.phase === 'accepted' || state.phase === 'notRequired');
}

function verifiedStatus(status: UgcTermsAcceptanceStatus): UgcTermsAcceptanceStatus {
  if (typeof status.required !== 'boolean' || typeof status.accepted !== 'boolean') {
    throw new Error('Terms acceptance status was unavailable.');
  }
  if (status.required && (
    !status.termsVersion
    || !status.termsSha256
    || !/^[a-f0-9]{64}$/i.test(status.termsSha256)
  )) {
    throw new Error('The current Terms version could not be verified.');
  }
  if (!status.required && !status.accepted) {
    throw new Error('Terms acceptance status was unavailable.');
  }
  return status;
}

export const checkUgcTermsAcceptance = createAsyncThunk<
  UgcTermsAcceptanceStatus, string, { rejectValue: string }
>('termsAcceptance/check', async (_userId, { rejectWithValue }) => {
  try {
    return verifiedStatus(await getJson<UgcTermsAcceptanceStatus>('/auth/terms-acceptance'));
  } catch (error: unknown) {
    return rejectWithValue(extractMessage(error, 'Could not verify the current Terms.'));
  }
});

export const acceptUgcTerms = createAsyncThunk<
  UgcTermsAcceptanceStatus,
  { userId: string; termsVersion: string; termsSha256: string },
  { rejectValue: string }
>('termsAcceptance/accept', async ({ termsVersion, termsSha256 }, { rejectWithValue }) => {
  try {
    const body: AcceptUgcTermsRequest = {
      accepted: true,
      termsVersion,
      termsSha256,
    };
    return verifiedStatus(await postJson<AcceptUgcTermsRequest, UgcTermsAcceptanceStatus>(
      '/auth/terms-acceptance',
      body,
    ));
  } catch (error: unknown) {
    return rejectWithValue(extractMessage(error, 'Could not record Terms acceptance.'));
  }
});

function setRequest(
  state: TermsAcceptanceState,
  userId: string,
  requestId: string,
  phase: TermsAcceptancePhase,
): void {
  state.userId = userId;
  state.activeRequestId = requestId;
  state.phase = phase;
  state.error = null;
}

const termsAcceptanceSlice = createSlice({
  name: 'termsAcceptance',
  initialState,
  reducers: {
    deferTermsForSession(state) {
      state.deferredForSession = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkUgcTermsAcceptance.pending, (state, action) => {
        setRequest(state, action.meta.arg, action.meta.requestId, 'checking');
      })
      .addCase(checkUgcTermsAcceptance.fulfilled, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
        state.activeRequestId = null;
        Object.assign(state, action.payload);
        state.phase = action.payload.required
          ? action.payload.accepted ? 'accepted' : 'required'
          : 'notRequired';
      })
      .addCase(checkUgcTermsAcceptance.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
        state.activeRequestId = null;
        state.phase = 'error';
        state.error = action.payload ?? 'Could not verify the current Terms.';
      })
      .addCase(acceptUgcTerms.pending, (state, action) => {
        setRequest(state, action.meta.arg.userId, action.meta.requestId, 'accepting');
      })
      .addCase(acceptUgcTerms.fulfilled, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.userId !== action.meta.arg.userId) return;
        state.activeRequestId = null;
        Object.assign(state, action.payload);
        state.phase = action.payload.required
          ? action.payload.accepted ? 'accepted' : 'required'
          : 'notRequired';
      })
      .addCase(acceptUgcTerms.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.userId !== action.meta.arg.userId) return;
        state.activeRequestId = null;
        state.phase = 'required';
        state.error = action.payload ?? 'Could not record Terms acceptance.';
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

export const { deferTermsForSession } = termsAcceptanceSlice.actions;

export default termsAcceptanceSlice.reducer;
