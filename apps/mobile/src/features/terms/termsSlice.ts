import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AcceptTermsRequest, AcceptTermsResponse, TermsStatusResponse } from '@g88/shared';
import { getJson, postJson } from '@/api/client';
import { logout, sessionEnded } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface TermsState {
  status: TermsStatusResponse | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  /** Ignore obsolete HTTP completions after logout/account switching or another refresh. */
  statusRequestId: string | null;
  acceptRequestId: string | null;
}
const initialState: TermsState = {
  status: null, loading: false, submitting: false, error: null,
  statusRequestId: null, acceptRequestId: null,
};
export const loadTermsStatus = createAsyncThunk<
  TermsStatusResponse, void, { rejectValue: string }
>('terms/status', async (_, { rejectWithValue }) => {
  try { return await getJson<TermsStatusResponse>('/terms/status', { timeout: 8000 }); }
  catch (error) { return rejectWithValue(extractMessage(error, 'Cannot check the current Terms.')); }
});
export const acceptTerms = createAsyncThunk<
  AcceptTermsResponse, AcceptTermsRequest, { rejectValue: string }
>('terms/accept', async (body, { rejectWithValue }) => {
  try { return await postJson<AcceptTermsRequest, AcceptTermsResponse>('/terms/accept', body); }
  catch (error) { return rejectWithValue(extractMessage(error, 'Could not record acceptance.')); }
});
const slice = createSlice({
  name: 'terms', initialState, reducers: {},
  extraReducers: builder => {
    builder.addCase(logout.fulfilled, () => initialState);
    builder.addCase(logout.rejected, () => initialState);
    builder.addCase(sessionEnded, () => initialState);
    builder.addCase(loadTermsStatus.pending, (s, a) => {
      s.statusRequestId = a.meta.requestId;
      s.status = null; s.loading = true; s.error = null;
    });
    builder.addCase(loadTermsStatus.fulfilled, (s, a) => {
      if (s.statusRequestId !== a.meta.requestId) return;
      s.statusRequestId = null;
      s.status = a.payload; s.loading = false; s.error = null;
    });
    builder.addCase(loadTermsStatus.rejected, (s, a) => {
      if (s.statusRequestId !== a.meta.requestId) return;
      s.statusRequestId = null;
      s.status = null; s.loading = false; s.error = a.payload ?? 'Unable to check Terms.';
    });
    builder.addCase(acceptTerms.pending, (s, a) => {
      s.acceptRequestId = a.meta.requestId;
      s.submitting = true; s.error = null;
    });
    builder.addCase(acceptTerms.fulfilled, (s, a) => {
      if (s.acceptRequestId !== a.meta.requestId) return;
      s.acceptRequestId = null;
      s.submitting = false; s.error = null;
      if (s.status?.version === a.payload.version) {
        s.status.accepted = true;
        s.status.required = false;
      }
    });
    builder.addCase(acceptTerms.rejected, (s, a) => {
      if (s.acceptRequestId !== a.meta.requestId) return;
      s.acceptRequestId = null;
      s.submitting = false; s.error = a.payload ?? 'Unable to save Terms acceptance.';
    });
  },
});
export default slice.reducer;
