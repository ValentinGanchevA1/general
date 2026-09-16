// apps/mobile/src/features/nudges/postSocialActivation.ts
//
// After a successful Wave or Message, arm a short-lived activation boost so the
// map trust nudge can surface immediately (bypass passive age gates).
// Client-only — no backend.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'g88:activation:postSocial';
/** How long the boost remains eligible after the social action. */
export const POST_SOCIAL_TTL_MS = 30 * 60 * 1000;

export type PostSocialSource = 'wave' | 'message';

export interface PostSocialPayload {
  at: number;
  source: PostSocialSource;
}

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore subscriber errors
    }
  });
}

/** Subscribe to arm/clear events (in-process). Returns unsubscribe. */
export function subscribePostSocialActivation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function signalPostSocialActivation(
  source: PostSocialSource,
): Promise<void> {
  const payload: PostSocialPayload = { at: Date.now(), source };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // still notify in-memory listeners so current session can boost
  }
  emit();
}

export async function clearPostSocialActivation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  emit();
}

/**
 * Returns payload when armed and within TTL; otherwise null (and clears stale).
 */
export async function getPostSocialActivation(
  now: number = Date.now(),
): Promise<PostSocialPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostSocialPayload;
    if (
      !parsed ||
      typeof parsed.at !== 'number' ||
      (parsed.source !== 'wave' && parsed.source !== 'message')
    ) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    if (now - parsed.at > POST_SOCIAL_TTL_MS) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Pure helper for unit tests. */
export function isPostSocialActive(
  payload: PostSocialPayload | null | undefined,
  now: number,
): boolean {
  if (!payload) return false;
  return now - payload.at <= POST_SOCIAL_TTL_MS;
}
