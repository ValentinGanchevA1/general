import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import {
  persistFirstRunWorldSelection,
  readWorldMode,
  readWorldSelectionPending,
  writeWorldMode,
} from './worldModeStorage';
import type { WorldModeId } from './worldModes';

export type WorldModeState = {
  selectedId: WorldModeId;
  ownerId: string | null;
  hydrated: boolean;
  firstRunPending: boolean;
  saving: boolean;
  hydrationRequestId: string | null;
  activationRequestId: string | null;
  error: string | null;
};

const initialState: WorldModeState = {
  selectedId: 'nexus',
  ownerId: null,
  hydrated: false,
  firstRunPending: false,
  saving: false,
  hydrationRequestId: null,
  activationRequestId: null,
  error: null,
};

export const hydrateWorldMode = createAsyncThunk(
  'worldModes/hydrate',
  async (userId: string, { rejectWithValue }) => {
    try {
      const [selectedId, firstRunPending] = await Promise.all([
        readWorldMode(userId),
        readWorldSelectionPending(userId),
      ]);
      return { userId, selectedId, firstRunPending };
    } catch {
      // Fail open to the existing NEXUS experience; a storage outage must not
      // trap a returning user on a mandatory onboarding screen.
      return rejectWithValue('Could not load your World Mode preference.');
    }
  },
  {
    condition: (userId, { getState }) => {
      const state = (getState() as { worldModes: WorldModeState }).worldModes;
      return !(state.ownerId === userId &&
        (state.hydrated || state.hydrationRequestId !== null || state.saving));
    },
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
  {
    condition: ({ userId }, { getState }) => {
      const state = (getState() as { worldModes: WorldModeState }).worldModes;
      return state.ownerId === userId && state.hydrated && !state.saving;
    },
  },
);

export const completeFirstRunWorldSelection = createAsyncThunk(
  'worldModes/completeFirstRun',
  async (value: { userId: string; id: WorldModeId }, { rejectWithValue }) => {
    try {
      await persistFirstRunWorldSelection(value.userId, value.id);
      return value;
    } catch {
      return rejectWithValue('Could not save your World selection. Try again, or continue with NEXUS.');
    }
  },
  {
    condition: ({ userId }, { getState }) => {
      const state = (getState() as { worldModes: WorldModeState }).worldModes;
      return state.ownerId === userId &&
        state.hydrated &&
        state.firstRunPending &&
        !state.saving;
    },
  },
);

const worldModesSlice = createSlice({
  name: 'worldModes',
  initialState,
  reducers: {
    clearWorldMode: () => initialState,
    clearWorldModeError: (state) => { state.error = null; },
    /** Session-only fallback; keep the route mounted until the portal completes. */
    skipWorldSelectionForSession: (state) => {
      state.selectedId = 'nexus';
      state.saving = false;
      state.activationRequestId = null;
      state.error = null;
    },
    /** Called only after the selected-World portal has finished. */
    finishFirstRunWorldSelection: (state) => {
      state.firstRunPending = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorldMode.pending, (state, action) => {
        state.ownerId = action.meta.arg;
        state.selectedId = 'nexus';
        state.hydrated = false;
        state.firstRunPending = false;
        state.saving = false;
        state.hydrationRequestId = action.meta.requestId;
        state.activationRequestId = null;
        state.error = null;
      })
      .addCase(hydrateWorldMode.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId ||
          state.hydrationRequestId !== action.meta.requestId || state.saving) return;
        state.selectedId = action.payload.selectedId;
        state.firstRunPending = action.payload.firstRunPending;
        state.hydrated = true;
        state.hydrationRequestId = null;
      })
      .addCase(hydrateWorldMode.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg ||
          state.hydrationRequestId !== action.meta.requestId) return;
        state.selectedId = 'nexus';
        state.firstRunPending = false;
        state.hydrated = true;
        state.hydrationRequestId = null;
        state.error = typeof action.payload === 'string'
          ? action.payload : 'Could not load your World Mode preference.';
      })
      .addCase(activateWorldMode.pending, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId) return;
        state.saving = true;
        state.activationRequestId = action.meta.requestId;
        state.error = null;
      })
      .addCase(activateWorldMode.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId ||
          state.activationRequestId !== action.meta.requestId) return;
        state.saving = false;
        state.activationRequestId = null;
        state.selectedId = action.payload.id;
      })
      .addCase(activateWorldMode.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId ||
          state.activationRequestId !== action.meta.requestId) return;
        state.saving = false;
        state.activationRequestId = null;
        state.error = typeof action.payload === 'string'
          ? action.payload : 'Could not save your World Mode. Try again.';
      })
      .addCase(completeFirstRunWorldSelection.pending, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId) return;
        state.saving = true;
        state.activationRequestId = action.meta.requestId;
        state.error = null;
      })
      .addCase(completeFirstRunWorldSelection.fulfilled, (state, action) => {
        if (state.ownerId !== action.payload.userId ||
          state.activationRequestId !== action.meta.requestId) return;
        state.selectedId = action.payload.id;
        // Keep WorldSelection registered until the portal transition completes.
        state.saving = false;
        state.activationRequestId = null;
      })
      .addCase(completeFirstRunWorldSelection.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg.userId ||
          state.activationRequestId !== action.meta.requestId) return;
        state.saving = false;
        state.activationRequestId = null;
        state.error = typeof action.payload === 'string'
          ? action.payload : 'Could not save your World selection. Try again.';
      });
  },
});

export const {
  clearWorldMode,
  clearWorldModeError,
  skipWorldSelectionForSession,
} = worldModesSlice.actions;
export default worldModesSlice.reducer;
