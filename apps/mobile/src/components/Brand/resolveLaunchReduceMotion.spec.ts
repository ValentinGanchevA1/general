import { AccessibilityInfo } from 'react-native';

import {
  LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS,
  resolveLaunchReduceMotion,
} from './resolveLaunchReduceMotion';

describe('resolveLaunchReduceMotion', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses the native Reduced Motion preference when it resolves', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    await expect(resolveLaunchReduceMotion()).resolves.toBe(true);
  });

  it('fails open to full motion when the native query rejects', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('native accessibility bridge unavailable'));

    await expect(resolveLaunchReduceMotion()).resolves.toBe(false);
  });

  it('cannot keep launch blocked when the native query never settles', async () => {
    jest.useFakeTimers();

    let resolveNative: ((value: boolean) => void) | undefined;
    const pendingNativePreference = new Promise<boolean>((resolve) => {
      resolveNative = resolve;
    });

    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(pendingNativePreference);

    const result = resolveLaunchReduceMotion();

    jest.advanceTimersByTime(LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS);
    await expect(result).resolves.toBe(false);

    // A late bridge response must not change the already-frozen launch mode.
    resolveNative?.(true);
    await Promise.resolve();
    await expect(result).resolves.toBe(false);
  });
});
