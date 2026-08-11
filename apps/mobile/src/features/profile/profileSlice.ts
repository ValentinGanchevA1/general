import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { UserProfile, UpdateProfileRequest } from '@g88/shared';

import { getJson, patchJson } from '@/api/client';
import { logout } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface ProfileState {
  profile: UserProfile | null;
  /** Initial / pull fetch only — never flipped by optimistic updates. */
  loading: boolean;
  /** true once the first fetch attempt has settled (success or failure). */
  initialized: boolean;
  /** In-flight PATCH /users/me/profile (optimistic UI may already show the change). */
  saving: boolean;
  error: string | null;
  /** Snapshot taken before an optimistic patch; restored on reject. */
  rollback: UserProfile | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  initialized: false,
  saving: false,
  error: null,
  rollback: null,
};

/** Apply a partial update onto a profile for optimistic UI. */
function applyOptimistic(profile: UserProfile, req: UpdateProfileRequest): UserProfile {
  return {
    ...profile,
    ...(req.displayName !== undefined ? { displayName: req.displayName } : {}),
    ...(req.bio !== undefined ? { bio: req.bio } : {}),
    ...(req.avatarUrl !== undefined ? { avatarUrl: req.avatarUrl } : {}),
    ...(req.visibility !== undefined ? { visibility: req.visibility } : {}),
    ...(req.goals !== undefined ? { goals: req.goals } : {}),
    ...(req.interests !== undefined ? { interests: req.interests } : {}),
    ...(req.dateOfBirth !== undefined ? { dateOfBirth: req.dateOfBirth } as Partial<UserProfile> : {}),
  };
}

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

      // Optimistic: patch local profile immediately; do NOT set `loading` (avoids full-screen flash).
      .addCase(updateProfile.pending, (state, action) => {
        state.saving = true;
        state.error = null;
        if (state.profile) {
          state.rollback = state.profile;
          state.profile = applyOptimistic(state.profile, action.meta.arg);
        }
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.saving = false;
        state.rollback = null;
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.saving = false;
        if (state.rollback) {
          state.profile = state.rollback;
          state.rollback = null;
        }
        state.error = action.payload as string;
      })

      .addCase(logout.fulfilled, () => initialState);
  },
});

export default profileSlice.reducer;
