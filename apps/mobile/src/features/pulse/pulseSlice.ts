// apps/mobile/src/features/pulse/pulseSlice.ts
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ActivityItem, ActivityType, FeedResponse } from '@g88/shared';

import { getJson } from '@/api/client';

export interface PulseState {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  pendingFilter: string | null;
}

const initialState: PulseState = {
  items: [],
  loading: false,
  error: null,
  lastFetchedAt: null,
  pendingFilter: null,
};

export interface FetchFeedArgs {
  types?: ActivityType[];
  since?: string;
}

export const fetchFeed = createAsyncThunk<FeedResponse, FetchFeedArgs | undefined>(
  'pulse/fetch',
  async (args, { rejectWithValue }) => {
    try {
      const qs: string[] = [];
      if (args?.types?.length) qs.push(`types=${encodeURIComponent(args.types.join(','))}`);
      if (args?.since) qs.push(`since=${encodeURIComponent(args.since)}`);
      const suffix = qs.length ? `?${qs.join('&')}` : '';
      return await getJson<FeedResponse>(`/feed${suffix}`);
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load Pulse');
    }
  },
);

const slice = createSlice({
  name: 'pulse',
  initialState,
  reducers: {
    clearPulse: (s) => { s.items = []; s.error = null; },
    setPendingFilter: (s, a: PayloadAction<string>) => { s.pendingFilter = a.payload; },
    clearPendingFilter: (s) => { s.pendingFilter = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchFeed.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchFeed.fulfilled, (s, a: PayloadAction<FeedResponse>) => {
      s.loading = false; s.items = a.payload.items; s.lastFetchedAt = new Date().toISOString();
    });
    b.addCase(fetchFeed.rejected, (s, a) => {
      s.loading = false;
      s.error = (a.payload as string | undefined) ?? a.error.message ?? 'Failed';
    });
  },
});

export const { clearPulse, setPendingFilter, clearPendingFilter } = slice.actions;
export default slice.reducer;
