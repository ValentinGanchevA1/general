import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { UserProfile, UpdateProfileRequest } from '@g88/shared';

import { getJson, patchJson } from '@/api/client';
import { logout } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  /** true once the first fetch attempt has settled (success or failure). */
  initialized: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  initialized: false,
  error: null,
};

export const fetchProfile = createAsyncThunk('profile/fetch', async (_, { rejectWithValue }) => {
  try {
    return await getJson<UserProfile>('/users/me/profile');
  } catch (e) {
    return rejectWithValue(extractMessage(e, 'Failed to load profile'));
  }
});

export const updateProfile = createAsyncThunk(
  'profile/update',
  async (req: UpdateProfileRequest, { rejectWithValue }) => {
    try {
      return await patchJson<UpdateProfileRequest, UserProfile>('/users/me/profile', req);
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Failed to update profile'));
    }
  },
);

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload as string;
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Reset when the user logs out.
      .addCase(logout.fulfilled, () => initialState);
  },
});

export default profileSlice.reducer;
