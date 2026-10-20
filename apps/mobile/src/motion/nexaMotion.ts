export const NEXA_MOTION_MS = {
  immediate: 110,
  standard: 180,
  sheet: 250,
  map: 320,
  celebration: 340,
} as const;

export type NexaMotionToken = keyof typeof NEXA_MOTION_MS;
export type NexaReducedMotionMode = 'skip' | 'crossfade';

export const NEXA_MOTION_SCALE = {
  press: 0.98,
  enter: 0.94,
  markerEnter: 0.88,
} as const;

/**
 * Canonical NEXA motion timing resolver.
 *
 * Reduced Motion never stretches animation time. Decorative motion can be
 * skipped entirely; essential state transitions use a short opacity-only
 * crossfade so the UI does not feel broken or discontinuous.
 */
export function resolveNexaMotionDuration(
  token: NexaMotionToken,
  reduceMotion: boolean,
  reducedMode: NexaReducedMotionMode = 'crossfade',
): number {
  const duration = NEXA_MOTION_MS[token];
  if (!reduceMotion) return duration;
  if (reducedMode === 'skip') return 0;
  return Math.min(duration, 120);
}
