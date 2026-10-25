import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getDiscoveryPointKey, type DiscoveryPoint, type DiscoveryPointKey } from '@g88/shared';

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
    upsertPoint(state, action: PayloadAction<DiscoveryPoint>) {
      const nextKey = getDiscoveryPointKey(action.payload);
      const index = state.points.findIndex(
        (point) => getDiscoveryPointKey(point) === nextKey,
      );
      if (index === -1) {
        state.points.push(action.payload);
        return;
      }
      state.points[index] = action.payload;
    },
    removePoint(state, action: PayloadAction<DiscoveryPointKey>) {
      const index = state.points.findIndex(
        (point) => getDiscoveryPointKey(point) === action.payload,
      );
      if (index !== -1) state.points.splice(index, 1);
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

export const { setPoints, upsertPoint, removePoint, setDiscoveryZoom } = discoverySlice.actions;
export default discoverySlice.reducer;
