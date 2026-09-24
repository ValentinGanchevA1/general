// apps/mobile/src/features/map/mapNoveltySlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { logout } from '@/features/auth/authSlice';

interface MapNoveltyState {
  /** Unseen entity pins near the last map viewport (tab badge). */
  newCount: number;
}

const initialState: MapNoveltyState = {
  newCount: 0,
};

const mapNoveltySlice = createSlice({
  name: 'mapNovelty',
  initialState,
  reducers: {
    setMapNewCount(state, action: PayloadAction<number>) {
      state.newCount = Math.max(0, Math.min(99, action.payload));
    },
    clearMapNewCount(state) {
      state.newCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const { setMapNewCount, clearMapNewCount } = mapNoveltySlice.actions;
export default mapNoveltySlice.reducer;
