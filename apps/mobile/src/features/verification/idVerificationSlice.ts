import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/api/client';
import type { IdVerificationStatus } from '@g88/shared';

export const startIdVerification = createAsyncThunk('verification/start', async () => {
  const { data } = await api.post('/verification/id/start');
  return data;
});

export const submitIdVerification = createAsyncThunk(
  'verification/submit',
  async (payload: {
    selfie: string;
    selfieContentType: string;
    idFront: string;
    idFrontContentType: string;
    idBack?: string;
    idBackContentType?: string;
  }) => {
    const { data } = await api.post('/verification/id/submit', payload);
    return data;
  }
);

export const fetchIdVerificationStatus = createAsyncThunk('verification/status', async () => {
  const { data } = await api.get('/verification/id/status');
  return data;
});

interface State {
  status: IdVerificationStatus;
  loading: boolean;
  error: string | null;
}

const initialState: State = {
  status: 'none',
  loading: false,
  error: null,
};

const slice = createSlice({
  name: 'idVerification',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchIdVerificationStatus.fulfilled, (state, action) => {
        state.status = action.payload.status;
      })
      .addCase(startIdVerification.fulfilled, (state, action) => {
        state.status = action.payload.status;
      })
      .addCase(submitIdVerification.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitIdVerification.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
      })
      .addCase(submitIdVerification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Verification failed';
      });
  },
});

export default slice.reducer;
