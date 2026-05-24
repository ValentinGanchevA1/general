import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DiscoveryPoint } from '@g88/shared';

interface DiscoveryState {
  points: DiscoveryPoint[];
}

const initialState: DiscoveryState = { points: [] };

const discoverySlice = createSlice({
  name: 'discovery',
  initialState,
  reducers: {
    setPoints(state, action: PayloadAction<DiscoveryPoint[]>) {
      state.points = action.payload;
    },
  },
});

export const { setPoints } = discoverySlice.actions;
export default discoverySlice.reducer;
