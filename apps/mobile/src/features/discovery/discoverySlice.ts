import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DiscoveryPoint } from '@g88/shared';

import { logout } from '@/features/auth/authSlice';

interface DiscoveryState {
  points: DiscoveryPoint[];
  /** Last debounced zoom actually committed to a discovery request. */
  zoom: number;
}

const initialState: DiscoveryState = {
  points: [],
  zoom: 12,
};

const discoverySlice = createSlice({
  name: 'discovery',
  initialState,
  reducers: {
    setPoints(state, action: PayloadAction<DiscoveryPoint[]>) {
      state.points = action.payload;
    },
    setDiscoveryZoom(state, action: PayloadAction<number>) {
      state.zoom = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const { setPoints, setDiscoveryZoom } = discoverySlice.actions;
export default discoverySlice.reducer;
