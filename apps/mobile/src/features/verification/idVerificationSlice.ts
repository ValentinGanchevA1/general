import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/api/client';
import type { IdVerificationStatus } from '@g88/shared';
import { withNexaMutationFeedback } from '@/haptics/nexaInteractionFeedback';
import { extractMessage } from '@/utils/extractMessage';

export const startIdVerification = createAsyncThunk('verification/start', async () => {
  const { data } = await api.post('/verification/id/start');
  return data;
});

export const submitIdVerification = createAsyncThunk(
  'verification/submit',
  async (
    payload: {
      selfie: string;
      selfieContentType: string;
      idFront: string;
      idFrontContentType: string;
      idBack?: string;
      idBackContentType?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      return await withNexaMutationFeedback(async () => {
        // Default client timeout is 15s — too low for selfie+ID base64 + server S3 PUTs
        // (emulator/host saw BadRequestError: request aborted from raw-body).
        const { data } = await api.post('/verification/id/submit', payload, {
          timeout: 90_000,
        });
        return data;
      }, 'commit');
    } catch (error) {
      return rejectWithValue(extractMessage(error, 'Verification failed'));
    }
  },
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
        state.error = typeof action.payload === 'string' ? action.payload : 'Verification failed';
      });
  },
});

export default slice.reducer;
