import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { CreateContentReportRequest, CreateContentReportResponse } from '@g88/shared';
import { postJson } from '@/api/client';
import { logout, sessionEnded } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface ReportsState { pending: boolean; error: string | null; lastSubmitted: string | null }
const initialState: ReportsState = { pending: false, error: null, lastSubmitted: null };

export const submitContentReport = createAsyncThunk<
  CreateContentReportResponse, CreateContentReportRequest, { rejectValue: string }
>('reports/submit', async (body, { rejectWithValue }) => {
  try {
    return await postJson<CreateContentReportRequest, CreateContentReportResponse>('/reports', body);
  } catch (error) {
    return rejectWithValue(extractMessage(error, 'Could not send report. Try again.'));
  }
}, { condition: (_body, { getState }) => {
  const state = getState() as { reports: ReportsState };
  return !state.reports.pending;
} });

const reportsSlice = createSlice({
  name: 'reports', initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(logout.fulfilled, () => initialState);
    builder.addCase(logout.rejected, () => initialState);
    builder.addCase(sessionEnded, () => initialState);
    builder.addCase(submitContentReport.pending, state => {
      state.pending = true; state.error = null;
    });
    builder.addCase(submitContentReport.fulfilled, (state, action) => {
      state.pending = false;
      state.lastSubmitted = action.meta.arg.targetId;
    });
    builder.addCase(submitContentReport.rejected, (state, action) => {
      state.pending = false;
      state.error = action.payload ?? 'Could not send report. Try again.';
    });
  },
});
export default reportsSlice.reducer;
