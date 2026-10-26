import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import {
  MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
  MAP_RENDERER_POLICY_VERSION,
  type MapRendererPolicyDto,
} from '@g88/shared';

import { api } from '@/api/client';

const STORAGE_KEY = '@g88/map-renderer-policy/v1';
export const MAP_RENDERER_POLICY_RETRY_MS = 15_000;

export interface CachedMapRendererPolicy {
  version: typeof MAP_RENDERER_POLICY_VERSION;
  mapLibreEnabled: boolean;
  savedAtMs: number;
  expiresAtMs: number;
}

export type MapRendererPolicyStatus = 'idle' | 'loading' | 'ready' | 'error';
export type MapRendererPolicySource = 'default' | 'cache' | 'network';

export interface MapRendererPolicyState {
  mapLibreEnabled: boolean;
  validUntilMs: number;
  nextRefreshAtMs: number;
  hydrated: boolean;
  status: MapRendererPolicyStatus;
  source: MapRendererPolicySource;
  error: 'unavailable' | null;
}

interface RefreshSuccess {
  policy: MapRendererPolicyDto;
  validUntilMs: number;
}

interface RefreshFailure {
  code: 'unavailable';
  retryAtMs: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Runtime validation for the public server policy. Never trust JSON shape alone. */
export function parseMapRendererPolicy(value: unknown): MapRendererPolicyDto | null {
  const record = asRecord(value);
  if (!record) return null;

  const ttl = record.cacheTtlSeconds;
  if (
    record.version !== MAP_RENDERER_POLICY_VERSION ||
    typeof record.mapLibreEnabled !== 'boolean' ||
    typeof ttl !== 'number' ||
    !Number.isInteger(ttl) ||
    ttl < 1 ||
    ttl > MAP_RENDERER_POLICY_CACHE_TTL_SECONDS
  ) {
    return null;
  }

  return {
    version: MAP_RENDERER_POLICY_VERSION,
    mapLibreEnabled: record.mapLibreEnabled,
    cacheTtlSeconds: ttl,
  };
}

export function createCachedMapRendererPolicy(
  policy: MapRendererPolicyDto,
  nowMs: number = Date.now(),
): CachedMapRendererPolicy {
  return {
    version: MAP_RENDERER_POLICY_VERSION,
    mapLibreEnabled: policy.mapLibreEnabled,
    savedAtMs: nowMs,
    expiresAtMs: nowMs + policy.cacheTtlSeconds * 1_000,
  };
}

/**
 * Validate persisted policy defensively. A cached enable can never outlive the
 * client-side maximum TTL, even if AsyncStorage is stale or tampered with.
 */
export function parseCachedMapRendererPolicy(
  value: unknown,
  nowMs: number = Date.now(),
): CachedMapRendererPolicy | null {
  const record = asRecord(value);
  if (!record) return null;

  const savedAtMs = record.savedAtMs;
  const expiresAtMs = record.expiresAtMs;
  if (
    record.version !== MAP_RENDERER_POLICY_VERSION ||
    typeof record.mapLibreEnabled !== 'boolean' ||
    typeof savedAtMs !== 'number' ||
    !Number.isInteger(savedAtMs) ||
    typeof expiresAtMs !== 'number' ||
    !Number.isInteger(expiresAtMs) ||
    savedAtMs > nowMs ||
    expiresAtMs <= nowMs ||
    expiresAtMs <= savedAtMs ||
    expiresAtMs - savedAtMs > MAP_RENDERER_POLICY_CACHE_TTL_SECONDS * 1_000
  ) {
    return null;
  }

  return {
    version: MAP_RENDERER_POLICY_VERSION,
    mapLibreEnabled: record.mapLibreEnabled,
    savedAtMs,
    expiresAtMs,
  };
}

async function clearCachedPolicyBestEffort(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Persistence failure must not widen renderer permission.
  }
}

async function loadCachedPolicy(): Promise<CachedMapRendererPolicy | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const parsed = parseCachedMapRendererPolicy(JSON.parse(raw));
    if (parsed !== null) return parsed;

    await clearCachedPolicyBestEffort();
    return null;
  } catch {
    await clearCachedPolicyBestEffort();
    return null;
  }
}

async function saveCachedPolicyBestEffort(policy: CachedMapRendererPolicy): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
  } catch {
    // In-memory policy remains bounded even when persistence is unavailable.
  }
}

function refreshFailure(nowMs: number = Date.now()): RefreshFailure {
  return {
    code: 'unavailable',
    retryAtMs: nowMs + MAP_RENDERER_POLICY_RETRY_MS,
  };
}

export const hydrateMapRendererPolicy = createAsyncThunk<
  CachedMapRendererPolicy | null
>('mapRendererPolicy/hydrate', async () => loadCachedPolicy());

export const refreshMapRendererPolicy = createAsyncThunk<
  RefreshSuccess,
  void,
  { rejectValue: RefreshFailure }
>('mapRendererPolicy/refresh', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<unknown>('/runtime-config/map-renderer', {
      timeout: 5_000,
    });
    const policy = parseMapRendererPolicy(response.data);
    if (policy === null) {
      await clearCachedPolicyBestEffort();
      return rejectWithValue(refreshFailure());
    }

    const cached = createCachedMapRendererPolicy(policy);
    await saveCachedPolicyBestEffort(cached);
    return {
      policy,
      validUntilMs: cached.expiresAtMs,
    };
  } catch {
    await clearCachedPolicyBestEffort();
    return rejectWithValue(refreshFailure());
  }
});

export const initialMapRendererPolicyState: MapRendererPolicyState = {
  mapLibreEnabled: false,
  validUntilMs: 0,
  nextRefreshAtMs: 0,
  hydrated: false,
  status: 'idle',
  source: 'default',
  error: null,
};

const mapRendererPolicySlice = createSlice({
  name: 'mapRendererPolicy',
  initialState: initialMapRendererPolicyState,
  reducers: {
    expireMapRendererPolicy(state) {
      state.mapLibreEnabled = false;
      state.validUntilMs = 0;
      state.source = 'default';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateMapRendererPolicy.fulfilled, (state, action) => {
        state.hydrated = true;
        if (action.payload === null) {
          state.mapLibreEnabled = false;
          state.validUntilMs = 0;
          state.nextRefreshAtMs = 0;
          state.source = 'default';
          return;
        }

        state.mapLibreEnabled = action.payload.mapLibreEnabled;
        state.validUntilMs = action.payload.expiresAtMs;
        state.nextRefreshAtMs = action.payload.expiresAtMs;
        state.source = 'cache';
      })
      .addCase(refreshMapRendererPolicy.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(refreshMapRendererPolicy.fulfilled, (state, action) => {
        state.mapLibreEnabled = action.payload.policy.mapLibreEnabled;
        state.validUntilMs = action.payload.validUntilMs;
        state.nextRefreshAtMs = action.payload.validUntilMs;
        state.status = 'ready';
        state.source = 'network';
        state.error = null;
      })
      .addCase(refreshMapRendererPolicy.rejected, (state, action) => {
        state.mapLibreEnabled = false;
        state.validUntilMs = 0;
        state.nextRefreshAtMs =
          action.payload?.retryAtMs ?? Date.now() + MAP_RENDERER_POLICY_RETRY_MS;
        state.status = 'error';
        state.source = 'default';
        state.error = action.payload?.code ?? 'unavailable';
      });
  },
});

export const { expireMapRendererPolicy } = mapRendererPolicySlice.actions;
export default mapRendererPolicySlice.reducer;
