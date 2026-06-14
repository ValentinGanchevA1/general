// apps/mobile/src/api/tokenStore.ts
//
// Auth tokens at rest. Previously stored as plaintext in AsyncStorage — a
// pre-beta hardening gap (a 30-day refresh token in plaintext = account
// takeover from a device backup/compromise). Now stored in the OS-backed
// secure store (Android Keystore / iOS Keychain) via react-native-keychain.
//
// The public interface (getAccessToken / getRefreshToken / set / clear) is
// unchanged, so callers (client.ts, authSlice.ts, useSocket.ts) need no edits.
// A one-time migration moves any legacy plaintext tokens into the keychain on
// first read after upgrade, so already-signed-in users aren't logged out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type { AuthTokens } from '@g88/shared';

// Both tokens live in a single keychain entry as a JSON blob under this service.
const SERVICE = 'g88.auth.tokens';
const ACCOUNT = 'g88';
// Legacy plaintext AsyncStorage keys (pre-encryption). Read once for migration,
// then removed.
const LEGACY = { access: 'g88:access_token', refresh: 'g88:refresh_token' } as const;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

// In-memory cache so the request interceptor (every outgoing call reads the
// access token) doesn't hit the native bridge each time. `undefined` = not yet
// loaded; `null` = loaded, nothing stored. Kept consistent on set/clear.
let cache: StoredTokens | null | undefined;
// Coalesces the concurrent first reads that fire at startup into one native
// load (single-flight). Cleared once the load settles.
let loadPromise: Promise<StoredTokens | null> | null = null;

async function persist(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(tokens), { service: SERVICE });
}

/** Move any legacy plaintext AsyncStorage tokens into the keychain, once. */
async function migrateLegacy(): Promise<StoredTokens | null> {
  try {
    const access = await AsyncStorage.getItem(LEGACY.access);
    const refresh = await AsyncStorage.getItem(LEGACY.refresh);
    if (access && refresh) {
      const tokens: StoredTokens = { accessToken: access, refreshToken: refresh };
      await persist(tokens);
      try {
        await AsyncStorage.multiRemove([LEGACY.access, LEGACY.refresh]);
      } catch {
        // Non-blocking: migration already succeeded (tokens are in the keychain).
        // A failed plaintext cleanup must NOT discard the session — clear() will
        // sweep the leftovers later.
      }
      return tokens;
    }
  } catch {
    // Migration is best-effort — a failure just means the user re-authenticates.
  }
  return null;
}

/**
 * Load stored tokens, preferring the keychain and falling back to a one-time
 * legacy migration. Cached for the process lifetime.
 */
async function load(): Promise<StoredTokens | null> {
  if (cache !== undefined) return cache;
  if (loadPromise) return loadPromise;
  // Only adopt the loaded value if set()/clear() hasn't run in the meantime —
  // otherwise an in-flight load could clobber freshly-written/cleared tokens.
  loadPromise = (async () => {
    try {
      const creds = await Keychain.getGenericPassword({ service: SERVICE });
      if (creds) {
        const parsed = JSON.parse(creds.password) as StoredTokens;
        if (cache === undefined) cache = parsed;
        return cache;
      }
    } catch {
      // Keychain read failed (e.g. no secure hardware) — fall through to legacy.
    }
    const migrated = await migrateLegacy();
    if (cache === undefined) cache = migrated;
    return cache;
  })().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    return (await load())?.accessToken ?? null;
  },
  async getRefreshToken(): Promise<string | null> {
    return (await load())?.refreshToken ?? null;
  },
  async set(tokens: AuthTokens): Promise<void> {
    const stored: StoredTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    cache = stored;
    await persist(stored);
  },
  async clear(): Promise<void> {
    cache = null;
    await Keychain.resetGenericPassword({ service: SERVICE });
    // Drop any legacy plaintext leftovers too (no-op once migrated).
    await AsyncStorage.multiRemove([LEGACY.access, LEGACY.refresh]).catch(() => {});
  },
};
