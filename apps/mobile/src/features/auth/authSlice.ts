import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';

import type { ApiError, AuthenticatedUser, LoginResponse, UserProfile } from '@g88/shared';

import { api, postJson } from '@/api/client';
import { tokenStore } from '@/api/tokenStore';
import { disconnectSocket } from '@/realtime/useSocket';
import { extractMessage } from '@/utils/extractMessage';

interface AuthState {
  user: AuthenticatedUser | null;
  loading: boolean;
  /**
   * True only while the boot-time session restore is in flight. Kept separate
   * from `loading` (which login/register/google share) so the splash gate never
   * unmounts the AuthScreen mid-login and wipes typed input.
   */
  restoring: boolean;
  error: string | null;
  /** Derived from UserProfile.profileComplete (bio IS NOT NULL). False after register until profile is saved. */
  profileSetupComplete: boolean;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  // Starts true: AppNavigator dispatches restoreSession unconditionally on mount,
  // so the cold-boot first frame shows the splash spinner, not an AuthScreen flash.
  restoring: true,
  error: null,
  profileSetupComplete: true,
};


export const login = createAsyncThunk(
  'auth/login',
  async (args: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await postJson<typeof args, LoginResponse>('/auth/login', args);
      await tokenStore.set(res.tokens);
      Sentry.setUser({ id: res.user.id });
      return res.user;
    } catch (e: unknown) {
      return rejectWithValue(extractMessage(e, 'Login failed'));
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
      Sentry.setUser({ id: res.user.id });
      return res.user;
    } catch (e: unknown) {
      return rejectWithValue(extractMessage(e, 'Registration failed'));
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
      Sentry.setUser({ id: res.user.id });
      return res.user;
    } catch (e: unknown) {
      return rejectWithValue(extractMessage(e, 'Google sign-in failed'));
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
  Sentry.setUser(null);
});

export const restoreSession = createAsyncThunk('auth/restore', async () => {
  const token = await tokenStore.getAccessToken();
  if (!token) return null;
  try {
    const { getJson } = await import('@/api/client');
    // Bound the boot-blocking check: if the network is slow/offline, fall through
    // to the Auth screen quickly instead of holding the splash gate for the full 15s.
    const user = await getJson<AuthenticatedUser>('/auth/me', { timeout: 8_000 });
    Sentry.setUser({ id: user.id });
    return user;
  } catch (e: unknown) {
    // Only drop the stored session on a genuine auth failure (401/403). A
    // network/timeout (statusCode 0) or transient server error (5xx, e.g. a
    // cold-start 503) must keep the token so a later launch can still restore.
    const statusCode = (e as ApiError | undefined)?.statusCode;
    if (statusCode === 401 || statusCode === 403) {
      await tokenStore.clear();
    }
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
        state.profileSetupComplete = true;
      })
      .addCase(login.rejected, rejected)

      .addCase(register.pending, pending)
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        // New user — drive them to ProfileCreation before Main.
        state.profileSetupComplete = false;
      })
      .addCase(register.rejected, rejected)

      .addCase(loginWithGoogle.pending, pending)
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.profileSetupComplete = true;
      })
      .addCase(loginWithGoogle.rejected, rejected)

      // Restore uses its own `restoring` flag (not the shared `loading`) so the
      // splash gate can't fire during an active login/register on the AuthScreen.
      .addCase(restoreSession.pending, (state) => {
        state.restoring = true;
        state.error = null;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.restoring = false;
        state.user = action.payload;
        state.profileSetupComplete = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.restoring = false;
        state.user = null;
      })

      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.error = null;
        state.profileSetupComplete = true;
      })
      .addCase(logout.rejected, (state) => {
        // Network failed but we still clear locally.
        state.loading = false;
        state.user = null;
        state.error = null;
        state.profileSetupComplete = true;
      })
      // Derive completion from the backend-computed profileComplete field (bio IS NOT NULL).
      // Catches both fetch and update so any profile response keeps the gate in sync.
      // String-matched to avoid a circular import with profileSlice.
      .addMatcher(
        (action) =>
          action.type === 'profile/fetch/fulfilled' ||
          action.type === 'profile/update/fulfilled',
        (state, action: PayloadAction<UserProfile>) => {
          state.profileSetupComplete = action.payload.profileComplete;
        },
      );
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
