import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { NexaPlaceDetail, NexaPlaceSaveState } from '@g88/shared';

import { deleteJson, getJson, postJson } from '@/api/client';
import { logout, sessionEnded } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface PlaceDetailEntry {
  detail: NexaPlaceDetail | null;
  loadId: string | null;
  saveId: string | null;
  error: string | null;
  receivedAt: number;
}

export interface PlaceDetailsState {
  entries: Record<string, PlaceDetailEntry>;
}

type ThunkConfig = {
  state: { places: PlaceDetailsState };
  rejectValue: string;
};

const initialState: PlaceDetailsState = { entries: {} };

function entry(state: PlaceDetailsState, placeId: string): PlaceDetailEntry {
  return state.entries[placeId] ??= {
    detail: null,
    loadId: null,
    saveId: null,
    error: null,
    receivedAt: 0,
  };
}

export const loadPlaceDetail = createAsyncThunk<
  { detail: NexaPlaceDetail; receivedAt: number },
  { placeId: string; force?: boolean },
  ThunkConfig
>(
  'places/loadDetail',
  async ({ placeId }, { rejectWithValue }) => {
    try {
      const detail = await getJson<NexaPlaceDetail>(`/places/${encodeURIComponent(placeId)}`);
      return { detail, receivedAt: Date.now() };
    } catch (error) {
      return rejectWithValue(extractMessage(error, 'Could not load place. Try again.'));
    }
  },
  {
    condition: ({ placeId, force }, { getState }) => {
      const current = getState().places.entries[placeId];
      if (current?.loadId || current?.saveId) return false;
      return force === true || current?.detail == null;
    },
  },
);

export const setPlaceSaved = createAsyncThunk<
  NexaPlaceSaveState,
  { placeId: string; saved: boolean },
  ThunkConfig
>(
  'places/setSaved',
  async ({ placeId, saved }, { rejectWithValue }) => {
    try {
      if (saved) {
        return await postJson<Record<string, never>, NexaPlaceSaveState>(
          `/places/${encodeURIComponent(placeId)}/save`,
          {},
        );
      }
      return await deleteJson<NexaPlaceSaveState>(`/places/${encodeURIComponent(placeId)}/save`);
    } catch (error) {
      return rejectWithValue(
        extractMessage(error, saved ? 'Could not save this place.' : 'Could not remove this saved place.'),
      );
    }
  },
  {
    condition: ({ placeId }, { getState }) => {
      const current = getState().places.entries[placeId];
      return current?.saveId == null && current?.detail != null;
    },
  },
);

const slice = createSlice({
  name: 'places',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => initialState);
    builder.addCase(logout.rejected, () => initialState);
    builder.addCase(sessionEnded, () => initialState);

    builder.addCase(loadPlaceDetail.pending, (state, action) => {
      const current = entry(state, action.meta.arg.placeId);
      current.loadId = action.meta.requestId;
      current.error = null;
    });
    builder.addCase(loadPlaceDetail.fulfilled, (state, action) => {
      const current = state.entries[action.meta.arg.placeId];
      if (!current || current.loadId !== action.meta.requestId) return;
      current.loadId = null;
      current.detail = action.payload.detail;
      current.receivedAt = action.payload.receivedAt;
      current.error = null;
    });
    builder.addCase(loadPlaceDetail.rejected, (state, action) => {
      const current = state.entries[action.meta.arg.placeId];
      if (!current || current.loadId !== action.meta.requestId) return;
      current.loadId = null;
      current.error = action.payload ?? 'Could not load place.';
    });

    builder.addCase(setPlaceSaved.pending, (state, action) => {
      const current = entry(state, action.meta.arg.placeId);
      current.saveId = action.meta.requestId;
      current.error = null;
    });
    builder.addCase(setPlaceSaved.fulfilled, (state, action) => {
      const current = state.entries[action.meta.arg.placeId];
      if (!current || current.saveId !== action.meta.requestId) return;
      current.saveId = null;
      if (current.detail) {
        current.detail.saved = action.payload.saved;
        current.detail.id = action.payload.placeId;
      }
      current.error = null;
    });
    builder.addCase(setPlaceSaved.rejected, (state, action) => {
      const current = state.entries[action.meta.arg.placeId];
      if (!current || current.saveId !== action.meta.requestId) return;
      current.saveId = null;
      current.error = action.payload ?? 'Could not update saved place.';
    });
  },
});

export default slice.reducer;
