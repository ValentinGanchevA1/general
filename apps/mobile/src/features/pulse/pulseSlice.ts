// apps/mobile/src/features/pulse/pulseSlice.ts
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  ActivityItem,
  ActivityType,
  CreatePulseCheckInRequest,
  FeedResponse,
  PulseCheckInResult,
} from '@g88/shared';

import { getJson, postJson } from '@/api/client';
import { logout } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

const MAX_PULSE_ITEMS = 100;

export interface PulseState {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  fetchStartedAt: string | null;
  pendingFilter: string | null;
  checkInSubmitting: boolean;
  checkInError: string | null;
}

const initialState: PulseState = {
  items: [],
  loading: false,
  error: null,
  lastFetchedAt: null,
  fetchStartedAt: null,
  pendingFilter: null,
  checkInSubmitting: false,
  checkInError: null,
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
      return rejectWithValue(extractMessage(e, 'Failed to load Pulse'));
    }
  },
);

export const createPulseCheckIn = createAsyncThunk<
  PulseCheckInResult,
  CreatePulseCheckInRequest,
  { rejectValue: string }
>(
  'pulse/createCheckIn',
  async (input, { rejectWithValue }) => {
    try {
      return await postJson<CreatePulseCheckInRequest, PulseCheckInResult>('/feed/check-ins', input);
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Could not check in'));
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
    clearCheckInError: (s) => { s.checkInError = null; },
    activityReceived: (s, a: PayloadAction<ActivityItem>) => {
      s.items = [a.payload, ...s.items.filter((item) => item.id !== a.payload.id)]
        .slice(0, MAX_PULSE_ITEMS);
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchFeed.pending, (s) => {
      s.loading = true;
      s.error = null;
      s.fetchStartedAt = new Date().toISOString();
    });
    b.addCase(fetchFeed.fulfilled, (s, a: PayloadAction<FeedResponse>) => {
      const startedAtMs = s.fetchStartedAt == null ? 0 : Date.parse(s.fetchStartedAt);
      const fetchedIds = new Set(a.payload.items.map((item) => item.id));
      const arrivedDuringFetch = s.items.filter((item) => (
        !fetchedIds.has(item.id)
        && Date.parse(item.createdAt) >= startedAtMs
      ));
      s.loading = false;
      s.items = [...arrivedDuringFetch, ...a.payload.items].slice(0, MAX_PULSE_ITEMS);
      s.lastFetchedAt = new Date().toISOString();
      s.fetchStartedAt = null;
    });
    b.addCase(fetchFeed.rejected, (s, a) => {
      s.loading = false;
      s.fetchStartedAt = null;
      s.error = typeof a.payload === 'string' ? a.payload : 'Failed to load Pulse';
    });
    b.addCase(createPulseCheckIn.pending, (s) => {
      s.checkInSubmitting = true;
      s.checkInError = null;
    });
    b.addCase(createPulseCheckIn.fulfilled, (s) => {
      s.checkInSubmitting = false;
      s.checkInError = null;
    });
    b.addCase(createPulseCheckIn.rejected, (s, a) => {
      s.checkInSubmitting = false;
      s.checkInError = a.payload ?? 'Could not check in';
    });
    b.addCase(logout.fulfilled, () => initialState);
    b.addCase(logout.rejected, () => initialState);
  },
});

export const {
  activityReceived,
  clearPulse,
  setPendingFilter,
  clearPendingFilter,
  clearCheckInError,
} = slice.actions;
export default slice.reducer;
