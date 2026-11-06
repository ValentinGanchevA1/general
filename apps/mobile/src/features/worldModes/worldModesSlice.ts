import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { readWorldMode, writeWorldMode } from './worldModeStorage';
import type { WorldModeId } from './worldModes';

export type WorldModeState = {
  selectedId: WorldModeId;
  ownerId: string | null;
  hydrated: boolean;
  saving: boolean;
  error: string | null;
};

const initialState: WorldModeState = {
  selectedId: 'nexus',
  ownerId: null,
  hydrated: false,
  saving: false,
  error: null,
};

export const hydrateWorldMode = createAsyncThunk(
  'worldModes/hydrate',
  async (userId: string, { rejectWithValue }) => {
    try {
      return { userId, selectedId: await readWorldMode(userId) };
    } catch {
      return rejectWithValue('Could not load your World Mode preference.');
    }
  },
);

export const activateWorldMode = createAsyncThunk(
  'worldModes/activate',
  async (value: { userId: string; id: WorldModeId }, { rejectWithValue }) => {
    try {
      await writeWorldMode(value.userId, value.id);
      return value;
    } catch {
      return rejectWithValue('Could not save your World Mode. Try again.');
    }
  },
);

const worldModesSlice = createSlice({
  name: 'worldModes',
  initialState,
  reducers: {
    clearWorldMode: () => initialState,
    clearWorldModeError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorldMode.pending, (state, action) => {
        state.ownerId = action.meta.arg;
        state.selectedId = 'nexus';
        state.hydrated = false;
        state.saving = false;
        state.error = null;
      })
      .addCase(hydrateWorldMode.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId || state.saving) return;
        state.selectedId = action.payload.selectedId;
        state.hydrated = true;
      })
      .addCase(hydrateWorldMode.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg) return;
        state.hydrated = true;
        state.error = typeof action.payload === 'string'
          ? action.payload : 'Could not load your World Mode preference.';
      })
      .addCase(activateWorldMode.pending, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId) return;
        state.saving = true;
        state.error = null;
      })
      .addCase(activateWorldMode.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId) return;
        state.saving = false;
        state.selectedId = action.payload.id;
      })
      .addCase(activateWorldMode.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId) return;
        state.saving = false;
        state.error = typeof action.payload === 'string'
          ? action.payload : 'Could not save your World Mode. Try again.';
      });
  },
});

export const { clearWorldMode, clearWorldModeError } = worldModesSlice.actions;
export default worldModesSlice.reducer;