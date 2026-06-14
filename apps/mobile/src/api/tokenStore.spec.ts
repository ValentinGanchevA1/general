/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports --
   module isolation: resetModules() + sync require() to reset the store's
   module-level cache and get fresh mock instances per case (babel keeps import()
   as native ESM, which jest can't run without experimental flags). */
import type { AuthTokens } from '@g88/shared';

// The store keeps a module-level cache, so each case loads a fresh module via
// jest.resetModules() to start from an empty (unloaded) cache + fresh mocks.
async function freshModules() {
  jest.resetModules();
  const Keychain = require('react-native-keychain');
  const asMod = require('@react-native-async-storage/async-storage');
  const AsyncStorage = asMod.default ?? asMod;
  await AsyncStorage.clear();
  const { tokenStore } = require('./tokenStore');
  return { Keychain, AsyncStorage, tokenStore };
}

const TOKENS: AuthTokens = {
  accessToken: 'acc-1',
  refreshToken: 'ref-1',
  expiresAt: '2026-06-14T00:15:00Z',
};

const LEGACY = { access: 'g88:access_token', refresh: 'g88:refresh_token' } as const;

describe('tokenStore (encrypted)', () => {
  it('round-trips tokens through the keychain (not AsyncStorage)', async () => {
    const { tokenStore, Keychain, AsyncStorage } = await freshModules();
    await tokenStore.set(TOKENS);

    expect(await tokenStore.getAccessToken()).toBe('acc-1');
    expect(await tokenStore.getRefreshToken()).toBe('ref-1');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'g88',
      JSON.stringify({ accessToken: 'acc-1', refreshToken: 'ref-1' }),
      { service: 'g88.auth.tokens' },
    );
    // No plaintext copy left in AsyncStorage.
    expect(await AsyncStorage.getItem(LEGACY.access)).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    const { tokenStore } = await freshModules();
    expect(await tokenStore.getAccessToken()).toBeNull();
    expect(await tokenStore.getRefreshToken()).toBeNull();
  });

  it('clear() wipes the keychain entry and the cache', async () => {
    const { tokenStore, Keychain } = await freshModules();
    await tokenStore.set(TOKENS);
    await tokenStore.clear();

    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'g88.auth.tokens' });
    expect(await tokenStore.getAccessToken()).toBeNull();
  });

  it('migrates legacy plaintext AsyncStorage tokens into the keychain, once', async () => {
    const { tokenStore, Keychain, AsyncStorage } = await freshModules();
    // Seed the pre-encryption plaintext tokens.
    await AsyncStorage.multiSet([
      [LEGACY.access, 'legacy-acc'],
      [LEGACY.refresh, 'legacy-ref'],
    ]);

    // First read migrates: returns the value, persists to keychain, clears legacy.
    expect(await tokenStore.getAccessToken()).toBe('legacy-acc');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'g88',
      JSON.stringify({ accessToken: 'legacy-acc', refreshToken: 'legacy-ref' }),
      { service: 'g88.auth.tokens' },
    );
    expect(await AsyncStorage.getItem(LEGACY.access)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY.refresh)).toBeNull();
  });

  it('does not migrate when only one legacy key is present', async () => {
    const { tokenStore, Keychain, AsyncStorage } = await freshModules();
    await AsyncStorage.setItem(LEGACY.access, 'orphan');

    expect(await tokenStore.getAccessToken()).toBeNull();
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });
});
