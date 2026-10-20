import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * App-wide Reduced Motion source.
 * Defaults to reduced motion until the OS preference resolves, which avoids
 * accidentally playing decorative motion during cold start.
 */
export function useNexaReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
