import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from '@g88/shared';

const KEYS = { access: 'g88:access_token', refresh: 'g88:refresh_token' } as const;

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.access);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.refresh);
  },
  async set(tokens: AuthTokens): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.access, tokens.accessToken],
      [KEYS.refresh, tokens.refreshToken],
    ]);
  },
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh]);
  },
};
