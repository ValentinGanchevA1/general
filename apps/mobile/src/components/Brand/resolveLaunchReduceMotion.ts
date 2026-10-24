import { AccessibilityInfo } from 'react-native';

export const LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS = 250;

/**
 * Resolve the motion mode exactly once for the current launch sequence.
 *
 * Launch animation must never depend indefinitely on a native accessibility
 * bridge response. We also intentionally freeze the value for this one launch:
 * changing the OS setting while the ~1s intro is already running must not tear
 * down the active Animated graph and leave the splash mounted forever. The new
 * preference is picked up on the next cold launch.
 */
export function resolveLaunchReduceMotion(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (enabled: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(enabled);
    };

    const timeoutId = setTimeout(() => {
      finish(false);
    }, LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS);

    void AccessibilityInfo.isReduceMotionEnabled()
      .then(finish)
      .catch(() => finish(false));
  });
}
