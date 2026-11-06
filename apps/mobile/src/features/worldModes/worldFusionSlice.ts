import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { readFusionDiscoveryWorld, writeFusionDiscoveryWorld } from './worldFusionStorage';
import type { WorldModeId } from './worldModes';

export type WorldFusionState = {
  ownerId: string | null;
  discoveryWorld: WorldModeId | null;
  hydrated: boolean;
  saving: boolean;
  hydrationRequestId: string | null;
  saveRequestId: string | null;
  error: string | null;
};

const initialState: WorldFusionState = {
  ownerId: null,
  discoveryWorld: null,
  hydrated: false,
  saving: false,
  hydrationRequestId: null,
  saveRequestId: null,
  error: null,
};

export const hydrateWorldFusion = createAsyncThunk(
  'worldFusion/hydrate',
  async (userId: string, { rejectWithValue }) => {
    try {
      return { userId, discoveryWorld: await readFusionDiscoveryWorld(userId) };
    } catch {
      return rejectWithValue('Could not load your Fusion preference. Try again.');
    }
  },
  {
    condition: (userId, { getState }) => {
      const state = (getState() as { worldFusion: WorldFusionState }).worldFusion;
      return !(state.ownerId === userId &&
        (state.hydrated || state.hydrationRequestId !== null || state.saving));
    },
  },
);

export const saveWorldFusion = createAsyncThunk(
  'worldFusion/save',
  async (
    value: { userId: string; discoveryWorld: WorldModeId | null },
    { rejectWithValue },
  ) => {
    try {
      await writeFusionDiscoveryWorld(value.userId, value.discoveryWorld);
      return value;
    } catch {
      return rejectWithValue('Could not save your Fusion. Try again.');
    }
  },
  {
    condition: ({ userId }, { getState }) => {
      const state = (getState() as { worldFusion: WorldFusionState }).worldFusion;
      return state.ownerId === userId && state.hydrated && !state.saving;
    },
  },
);

const worldFusionSlice = createSlice({
  name: 'worldFusion',
  initialState,
  reducers: {
    clearWorldFusion: () => initialState,
    clearWorldFusionError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorldFusion.pending, (state, action) => {
        state.ownerId = action.meta.arg;
        state.discoveryWorld = null;
        state.hydrated = false;
        state.saving = false;
        state.hydrationRequestId = action.meta.requestId;
        state.saveRequestId = null;
        state.error = null;
      })
      .addCase(hydrateWorldFusion.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId ||
            state.hydrationRequestId !== action.meta.requestId ||
            state.saving) return;
        state.discoveryWorld = action.payload.discoveryWorld;
        state.hydrated = true;
        state.hydrationRequestId = null;
      })
      .addCase(hydrateWorldFusion.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg ||
            state.hydrationRequestId !== action.meta.requestId) return;
        state.hydrated = true;
        state.hydrationRequestId = null;
        state.error = typeof action.payload === 'string'
          ? action.payload
          : 'Could not load your Fusion preference. Try again.';
      })
      .addCase(saveWorldFusion.pending, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId) return;
        state.saving = true;
        state.saveRequestId = action.meta.requestId;
        state.error = null;
      })
      .addCase(saveWorldFusion.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId ||
            state.saveRequestId !== action.meta.requestId) return;
        state.discoveryWorld = action.payload.discoveryWorld;
        state.saving = false;
        state.saveRequestId = null;
      })
      .addCase(saveWorldFusion.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId ||
            state.saveRequestId !== action.meta.requestId) return;
        state.saving = false;
        state.saveRequestId = null;
        state.error = typeof action.payload === 'string'
          ? action.payload : 'Could not save your Fusion. Try again.';
      });
  },
});

export const { clearWorldFusion, clearWorldFusionError } = worldFusionSlice.actions;
export default worldFusionSlice.reducer;
