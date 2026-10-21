import {
  AppState,
  Platform,
  Vibration,
  type AppStateStatus,
} from 'react-native';

export type NexaHapticIntent =
  | 'select'
  | 'discover'
  | 'connect'
  | 'commit'
  | 'success'
  | 'warning'
  | 'error';

export type NexaHapticOrigin = 'direct' | 'realtime' | 'system';
export type NexaHapticPlatform = 'android' | 'ios' | 'other';

export interface NexaHapticOptions {
  /**
   * Direct = user initiated. Realtime = foreground Socket.IO / ambient arrival.
   * System = passive/background state change. Raw trigger calls default to realtime;
   * product CTAs should use the `nexaHaptics` direct-action facade below.
   */
  origin?: NexaHapticOrigin;
  /** Injectable for deterministic tests; defaults to React Native AppState. */
  appState?: AppStateStatus;
  /** Injectable for deterministic tests; defaults to Date.now(). */
  now?: number;
}

const COOLDOWN_MS: Record<NexaHapticIntent, number> = {
  select: 80,
  discover: 140,
  connect: 220,
  commit: 240,
  success: 320,
  warning: 400,
  error: 450,
};

const GLOBAL_GAP_MS = 55;

const ANDROID_PATTERNS: Record<NexaHapticIntent, number | number[]> = {
  select: 8,
  discover: 12,
  connect: 16,
  commit: 18,
  success: [0, 16, 48, 22],
  warning: [0, 18, 55, 34],
  error: [0, 24, 46, 32],
};

const lastTriggeredAt: Partial<Record<NexaHapticIntent, number>> = {};
let lastAnyTriggeredAt: number | undefined;

function currentPlatform(): NexaHapticPlatform {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return 'other';
}

/**
 * Native-safe haptic resolution.
 *
 * Android has a conservative Vibration fallback behind this semantic adapter.
 * iOS intentionally stays silent until a real native haptic driver is added;
 * full-device vibration is too aggressive for selection feedback.
 */
export function resolveNexaHapticPattern(
  intent: NexaHapticIntent,
  platform: NexaHapticPlatform,
): number | number[] | null {
  return platform === 'android' ? ANDROID_PATTERNS[intent] : null;
}

/**
 * Unsolicited realtime activity must never feel like a user-confirmed action.
 * Only high-signal success celebrations may emit tactile feedback from realtime,
 * and only while the app is active. Passive/system changes are always silent.
 */
export function shouldEmitNexaHaptic(
  intent: NexaHapticIntent,
  origin: NexaHapticOrigin,
  appState: AppStateStatus,
): boolean {
  if (appState !== 'active') return false;
  if (origin === 'system') return false;
  if (origin === 'realtime') return intent === 'success';
  return true;
}

export function canEmitNexaHaptic(
  intent: NexaHapticIntent,
  now: number,
  previousAt: number | undefined,
  previousAnyAt?: number,
): boolean {
  const intentReady = previousAt == null || now - previousAt >= COOLDOWN_MS[intent];
  const globalReady = previousAnyAt == null || now - previousAnyAt >= GLOBAL_GAP_MS;
  return intentReady && globalReady;
}

export function triggerNexaHaptic(
  intent: NexaHapticIntent,
  options: NexaHapticOptions = {},
): void {
  const origin = options.origin ?? 'realtime';
  const appState = options.appState ?? AppState.currentState;
  if (!shouldEmitNexaHaptic(intent, origin, appState)) return;

  const pattern = resolveNexaHapticPattern(intent, currentPlatform());
  if (pattern == null) return;

  const now = options.now ?? Date.now();
  if (!canEmitNexaHaptic(intent, now, lastTriggeredAt[intent], lastAnyTriggeredAt)) return;

  lastTriggeredAt[intent] = now;
  lastAnyTriggeredAt = now;

  try {
    Vibration.vibrate(pattern);
  } catch {
    // Haptics are enhancement-only; never block the interaction path.
  }
}

function triggerDirect(intent: NexaHapticIntent): void {
  triggerNexaHaptic(intent, { origin: 'direct' });
}

/**
 * Direct user-interaction facade. Prefer this object from buttons, sheets and
 * mutation flows. Ambient/realtime systems should call triggerNexaHaptic with an
 * explicit origin (or rely on its realtime-safe default).
 */
export const nexaHaptics = {
  select: (): void => triggerDirect('select'),
  discover: (): void => triggerDirect('discover'),
  connect: (): void => triggerDirect('connect'),
  commit: (): void => triggerDirect('commit'),
  success: (): void => triggerDirect('success'),
  warning: (): void => triggerDirect('warning'),
  error: (): void => triggerDirect('error'),
} as const;
