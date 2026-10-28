// apps/mobile/src/features/pulse/pulseSlice.ts
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  ActivityItem,
  ActivityType,
  CreatePlacePulseCheckInRequest,
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
  realtimeIdsDuringFetch: string[];
  realtimeRemovedIdsDuringFetch: string[];
  pendingFilter: string | null;
  checkInSubmitting: boolean;
  checkInError: string | null;
}

const initialState: PulseState = {
  items: [],
  loading: false,
  error: null,
  lastFetchedAt: null,
  realtimeIdsDuringFetch: [],
  realtimeRemovedIdsDuringFetch: [],
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

export const createPlacePulseCheckIn = createAsyncThunk<
  PulseCheckInResult,
  CreatePlacePulseCheckInRequest,
  { rejectValue: string }
>(
  'pulse/createPlaceCheckIn',
  async (input, { rejectWithValue }) => {
    try {
      return await postJson<CreatePlacePulseCheckInRequest, PulseCheckInResult>(
        '/feed/check-ins/by-place',
        input,
      );
    } catch (e) {
      return rejectWithValue(extractMessage(e, 'Could not check in here'));
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
      s.realtimeRemovedIdsDuringFetch = s.realtimeRemovedIdsDuringFetch
        .filter((id) => id !== a.payload.id);
      if (s.loading && !s.realtimeIdsDuringFetch.includes(a.payload.id)) {
        s.realtimeIdsDuringFetch.push(a.payload.id);
      }
    },
    activityRemoved: (s, a: PayloadAction<string>) => {
      s.items = s.items.filter((item) => item.id !== a.payload);
      s.realtimeIdsDuringFetch = s.realtimeIdsDuringFetch.filter((id) => id !== a.payload);
      if (s.loading && !s.realtimeRemovedIdsDuringFetch.includes(a.payload)) {
        s.realtimeRemovedIdsDuringFetch.push(a.payload);
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchFeed.pending, (s) => {
      s.loading = true;
      s.error = null;
      s.realtimeIdsDuringFetch = [];
      s.realtimeRemovedIdsDuringFetch = [];
    });
    b.addCase(fetchFeed.fulfilled, (s, a: PayloadAction<FeedResponse>) => {
      const removedIds = new Set(s.realtimeRemovedIdsDuringFetch);
      const fetchedItems = a.payload.items.filter((item) => !removedIds.has(item.id));
      const fetchedIds = new Set(fetchedItems.map((item) => item.id));
      const realtimeIds = new Set(s.realtimeIdsDuringFetch);
      const arrivedDuringFetch = s.items.filter((item) => (
        realtimeIds.has(item.id)
        && !fetchedIds.has(item.id)
        && !removedIds.has(item.id)
      ));
      s.loading = false;
      s.items = [...arrivedDuringFetch, ...fetchedItems].slice(0, MAX_PULSE_ITEMS);
      s.lastFetchedAt = new Date().toISOString();
      s.realtimeIdsDuringFetch = [];
      s.realtimeRemovedIdsDuringFetch = [];
    });
    b.addCase(fetchFeed.rejected, (s, a) => {
      s.loading = false;
      s.realtimeIdsDuringFetch = [];
      s.realtimeRemovedIdsDuringFetch = [];
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
    b.addCase(createPlacePulseCheckIn.pending, (s) => {
      s.checkInSubmitting = true;
      s.checkInError = null;
    });
    b.addCase(createPlacePulseCheckIn.fulfilled, (s) => {
      s.checkInSubmitting = false;
      s.checkInError = null;
    });
    b.addCase(createPlacePulseCheckIn.rejected, (s, a) => {
      s.checkInSubmitting = false;
      s.checkInError = a.payload ?? 'Could not check in here';
    });
    b.addCase(logout.fulfilled, () => initialState);
    b.addCase(logout.rejected, () => initialState);
  },
});

export const {
  activityReceived,
  activityRemoved,
  clearPulse,
  setPendingFilter,
  clearPendingFilter,
  clearCheckInError,
} = slice.actions;
export default slice.reducer;
