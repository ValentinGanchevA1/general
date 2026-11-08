import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AdultAgeStatus } from '@g88/shared';
import { getJson } from '@/api/client';
import { extractMessage } from '@/utils/extractMessage';
import { logout, sessionEnded } from './authSlice';

interface AdultAgeState {
  userId: string | null;
  status: AdultAgeStatus | null;
  loading: boolean;
  error: string | null;
  requestId: string | null;
}
const initialState: AdultAgeState = {
  userId: null, status: null, loading: false, error: null, requestId: null,
};

/** The server determines eligibility; a client DOB picker cannot unlock access. */
export const loadAdultAgeStatus = createAsyncThunk<
  AdultAgeStatus, string, { rejectValue: string }
>('adultAge/status', async (_userId, { rejectWithValue }) => {
  try {
    return await getJson<AdultAgeStatus>('/auth/age-status', { timeout: 8_000 });
  } catch (error) {
    return rejectWithValue(extractMessage(error, 'Age verification could not be checked.'));
  }
});

const adultAgeSlice = createSlice({
  name: 'adultAge', initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => initialState);
    builder.addCase(logout.fulfilled, () => initialState);
    builder.addCase(logout.rejected, () => initialState);
    builder.addCase(loadAdultAgeStatus.pending, (state, action) => {
      state.userId = action.meta.arg;
      state.status = null;
      state.loading = true;
      state.error = null;
      state.requestId = action.meta.requestId;
    });
    builder.addCase(loadAdultAgeStatus.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
      state.status = action.payload;
      state.loading = false;
      state.error = null;
      state.requestId = null;
    });
    builder.addCase(loadAdultAgeStatus.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
      state.status = null;
      state.loading = false;
      state.error = action.payload ?? 'Age verification is unavailable.';
      state.requestId = null;
    });
  },
});
export default adultAgeSlice.reducer;
