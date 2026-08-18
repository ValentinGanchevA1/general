import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@g88/pendingPhoneVerify';

/** Queue a phone for verification right after register (AuthScreen → Verification). */
export async function setPendingPhoneVerify(phone: string): Promise<void> {
  const trimmed = phone.trim();
  if (trimmed.length < 8) return;
  await AsyncStorage.setItem(KEY, trimmed);
}

/** Read-and-clear pending phone (once). */
export async function takePendingPhoneVerify(): Promise<string | null> {
  const v = await AsyncStorage.getItem(KEY);
  if (v) await AsyncStorage.removeItem(KEY);
  return v;
}
