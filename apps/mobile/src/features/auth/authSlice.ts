import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

import type { AuthenticatedUser, LoginResponse } from '@g88/shared';

import { api, postJson } from '@/api/client';
import { tokenStore } from '@/api/tokenStore';
import { disconnectSocket } from '@/realtime/useSocket';

interface AuthState {
  user: AuthenticatedUser | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = { user: null, loading: false, error: null };

export const login = createAsyncThunk(
  'auth/login',
  async (args: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await postJson<typeof args, LoginResponse>('/auth/login', args);
      await tokenStore.set(res.tokens);
      return res.user;
    } catch (e: unknown) {
      return rejectWithValue(e instanceof Error ? e.message : 'Login failed');
    }
  },
);

export const register = createAsyncThunk(
  'auth/register',
  async (
    args: { email: string; password: string; displayName: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await postJson<typeof args, LoginResponse>('/auth/register', args);
      await tokenStore.set(res.tokens);
      return res.user;
    } catch (e: unknown) {
      return rejectWithValue(e instanceof Error ? e.message : 'Registration failed');
    }
  },
);

export const loginWithGoogle = createAsyncThunk(
  'auth/loginWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return rejectWithValue('Google sign-in cancelled');
      }
      const idToken = response.data.idToken;
      if (!idToken) return rejectWithValue('No ID token returned from Google');
      const res = await postJson<{ idToken: string }, LoginResponse>('/auth/oauth/google', { idToken });
      await tokenStore.set(res.tokens);
      return res.user;
    } catch (e: unknown) {
      return rejectWithValue(e instanceof Error ? e.message : 'Google sign-in failed');
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  // Fire-and-forget: revoke the refresh token server-side.
  // If the network is down or the token is already expired, we still clear locally.
  const refreshToken = await tokenStore.getRefreshToken();
  if (refreshToken) {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // best-effort
    }
  }
  disconnectSocket();
  await tokenStore.clear();
});

export const restoreSession = createAsyncThunk('auth/restore', async () => {
  const token = await tokenStore.getAccessToken();
  if (!token) return null;
  try {
    const { getJson } = await import('@/api/client');
    return await getJson<AuthenticatedUser>('/auth/me');
  } catch {
    await tokenStore.clear();
    return null;
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state: AuthState) => {
      state.loading = true;
      state.error = null;
    };
    const rejected = (state: AuthState, action: { payload?: unknown }) => {
      state.loading = false;
      state.error = (action.payload as string | undefined) ?? 'Something went wrong';
    };

    builder
      .addCase(login.pending, pending)
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(login.rejected, rejected)

      .addCase(register.pending, pending)
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(register.rejected, rejected)

      .addCase(loginWithGoogle.pending, pending)
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginWithGoogle.rejected, rejected)

      .addCase(restoreSession.pending, pending)
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
        state.user = null;
      })

      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        // Network failed but we still clear locally.
        state.loading = false;
        state.user = null;
        state.error = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
