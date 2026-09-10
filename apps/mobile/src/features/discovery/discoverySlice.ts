import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DiscoveryPoint } from '@g88/shared';

import { logout } from '@/features/auth/authSlice';

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
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const { setPoints } = discoverySlice.actions;
export default discoverySlice.reducer;
