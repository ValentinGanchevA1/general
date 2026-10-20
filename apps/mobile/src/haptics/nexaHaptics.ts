import { Platform, Vibration } from 'react-native';

export type NexaHapticIntent =
  | 'select'
  | 'discover'
  | 'connect'
  | 'success'
  | 'warning';

export type NexaHapticPlatform = 'android' | 'ios' | 'other';

const COOLDOWN_MS: Record<NexaHapticIntent, number> = {
  select: 80,
  discover: 140,
  connect: 220,
  success: 320,
  warning: 400,
};

const ANDROID_PATTERNS: Record<NexaHapticIntent, number | number[]> = {
  select: 8,
  discover: 12,
  connect: 16,
  success: [0, 16, 48, 22],
  warning: [0, 18, 55, 34],
};

const lastTriggeredAt: Partial<Record<NexaHapticIntent, number>> = {};

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

export function canEmitNexaHaptic(
  intent: NexaHapticIntent,
  now: number,
  previousAt: number | undefined,
): boolean {
  return previousAt == null || now - previousAt >= COOLDOWN_MS[intent];
}

export function triggerNexaHaptic(intent: NexaHapticIntent): void {
  const pattern = resolveNexaHapticPattern(intent, currentPlatform());
  if (pattern == null) return;

  const now = Date.now();
  if (!canEmitNexaHaptic(intent, now, lastTriggeredAt[intent])) return;
  lastTriggeredAt[intent] = now;

  try {
    Vibration.vibrate(pattern);
  } catch {
    // Haptics are enhancement-only; never block the interaction path.
  }
}

export const nexaHaptics = {
  select: (): void => triggerNexaHaptic('select'),
  discover: (): void => triggerNexaHaptic('discover'),
  connect: (): void => triggerNexaHaptic('connect'),
  success: (): void => triggerNexaHaptic('success'),
  warning: (): void => triggerNexaHaptic('warning'),
} as const;
