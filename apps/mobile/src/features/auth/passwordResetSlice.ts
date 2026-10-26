import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, ResetPasswordResponse } from '@g88/shared';
import { postJson } from '@/api/client';
import { extractMessage } from '@/utils/extractMessage';

interface PasswordResetState {
  step: 'email' | 'code' | 'success';
  busy: boolean;
  error: string | null;
  message: string;
  retryAt: number;
  requestId: string | null;
}
const initialState: PasswordResetState = {
  step: 'email', busy: false, error: null, message: '', retryAt: 0, requestId: null,
};
const canSubmit = (_: unknown, { getState }: { getState: () => unknown }): boolean =>
  !(getState() as { passwordReset: PasswordResetState }).passwordReset.busy;

export const requestPasswordReset = createAsyncThunk(
  'passwordReset/request',
  async (input: ForgotPasswordRequest, { rejectWithValue }) => {
    try {
      const response = await postJson<ForgotPasswordRequest, ForgotPasswordResponse>('/auth/forgot-password', input);
      return { ...response, retryAt: Date.now() + response.retryAfterSeconds * 1_000 };
    } catch (error: unknown) {
      return rejectWithValue(extractMessage(error, 'Could not request a reset code. Please try again.'));
    }
  },
  { condition: canSubmit },
);

export const resetPassword = createAsyncThunk(
  'passwordReset/confirm',
  async (input: ResetPasswordRequest, { rejectWithValue }) => {
    try {
      return await postJson<ResetPasswordRequest, ResetPasswordResponse>('/auth/reset-password', input);
    } catch (error: unknown) {
      return rejectWithValue(extractMessage(error, 'Could not reset your password. Please try again.'));
    }
  },
  { condition: canSubmit },
);

const slice = createSlice({
  name: 'passwordReset', initialState,
  reducers: {
    clearPasswordRecovery: () => initialState,
    clearRecoveryError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestPasswordReset.pending, (state, action) => {
        state.busy = true; state.error = null; state.requestId = action.meta.requestId;
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.busy = false; state.step = 'code'; state.message = action.payload.message;
        state.retryAt = action.payload.retryAt; state.requestId = null;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.busy = false; state.error = String(action.payload ?? 'Could not request a reset code.'); state.requestId = null;
      })
      .addCase(resetPassword.pending, (state, action) => {
        state.busy = true; state.error = null; state.requestId = action.meta.requestId;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.busy = false; state.step = 'success'; state.message = action.payload.message; state.requestId = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.busy = false; state.error = String(action.payload ?? 'Could not reset your password.'); state.requestId = null;
      });
  },
});
export const { clearPasswordRecovery, clearRecoveryError } = slice.actions;
export default slice.reducer;
