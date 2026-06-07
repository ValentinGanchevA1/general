import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/api/client';
import type { IdVerificationStatus } from '@g88/shared';

export const startIdVerification = createAsyncThunk('verification/start', async () => {
  const { data } = await api.post('/verification/id/start');
  return data;
});

export const submitIdVerification = createAsyncThunk(
  'verification/submit',
  async (payload: { selfieKey: string; idFrontKey: string; idBackKey?: string }) => {
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
      // add more cases for start/submit as needed
  },
});

export default slice.reducer;
