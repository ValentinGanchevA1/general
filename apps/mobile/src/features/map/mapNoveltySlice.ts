// apps/mobile/src/features/map/mapNoveltySlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { logout } from '@/features/auth/authSlice';

interface MapNoveltyState {
  /** Aggregate unseen public map entities shown on the Map tab badge. */
  newCount: number;
  /** Legacy People / Events / Listings novelty count. */
  legacyNewCount: number;
  /** Public thresholded Place entity novelty count. */
  placeNewCount: number;
}

const initialState: MapNoveltyState = {
  newCount: 0,
  legacyNewCount: 0,
  placeNewCount: 0,
};

function clampCount(value: number): number {
  return Math.max(0, Math.min(99, value));
}

function refreshAggregate(state: MapNoveltyState): void {
  state.newCount = clampCount(state.legacyNewCount + state.placeNewCount);
}

const mapNoveltySlice = createSlice({
  name: 'mapNovelty',
  initialState,
  reducers: {
    setMapNewCount(state, action: PayloadAction<number>) {
      state.legacyNewCount = clampCount(action.payload);
      refreshAggregate(state);
    },
    setPlaceMapNewCount(state, action: PayloadAction<number>) {
      state.placeNewCount = clampCount(action.payload);
      refreshAggregate(state);
    },
    clearPlaceMapNewCount(state) {
      state.placeNewCount = 0;
      refreshAggregate(state);
    },
    clearMapNewCount(state) {
      state.newCount = 0;
      state.legacyNewCount = 0;
      state.placeNewCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const {
  setMapNewCount,
  setPlaceMapNewCount,
  clearPlaceMapNewCount,
  clearMapNewCount,
} = mapNoveltySlice.actions;
export default mapNoveltySlice.reducer;
