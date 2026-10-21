import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

const VIOLET = '#7C5CFC';
const CYAN = '#27D3F2';
const CORE = '#F7F8FA';
const HANDOFF_DURATION_MS = 460;

export interface NexaSpatialMapHandoffProps {
  onComplete: () => void;
}

/**
 * Final NEXA launch handoff over the already-mounted application.
 *
 * The launch eye has just dissolved. Two lightweight discovery fields continue
 * from the same optical centre and expand across the live surface, making the
 * transition read as the NEXA signal opening into spatial context rather than
 * as a logo screen cutting to the app.
 *
 * This layer never blocks input and never waits for location, networking or
 * realtime state. Reduced Motion skips the decorative expansion entirely.
 */
export function NexaSpatialMapHandoff({
  onComplete,
}: NexaSpatialMapHandoffProps): React.JSX.Element {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [cyanScale] = useState(() => new Animated.Value(0.72));
  const [cyanOpacity] = useState(() => new Animated.Value(0.62));
  const [violetScale] = useState(() => new Animated.Value(0.66));
  const [violetOpacity] = useState(() => new Animated.Value(0.44));
  const [fieldScale] = useState(() => new Animated.Value(0.58));
  const [fieldOpacity] = useState(() => new Animated.Value(0.18));
  const [horizonScale] = useState(() => new Animated.Value(0.78));
  const [horizonOpacity] = useState(() => new Animated.Value(0.72));

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;

    if (reduceMotion) {
      onComplete();
      return;
    }

    const animation = Animated.parallel([
      Animated.parallel([
        Animated.timing(cyanScale, {
          toValue: 2.7,
          duration: HANDOFF_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cyanOpacity, {
          toValue: 0,
          duration: HANDOFF_DURATION_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(54),
        Animated.parallel([
          Animated.timing(violetScale, {
            toValue: 2.35,
            duration: HANDOFF_DURATION_MS - 54,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(violetOpacity, {
            toValue: 0,
            duration: HANDOFF_DURATION_MS - 54,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(fieldScale, {
          toValue: 4.4,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fieldOpacity, {
          toValue: 0,
          duration: 330,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(horizonScale, {
          toValue: 1.65,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(horizonOpacity, {
          toValue: 0,
          duration: 290,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) onComplete();
    });

    return () => animation.stop();
  }, [
    cyanOpacity,
    cyanScale,
    fieldOpacity,
    fieldScale,
    horizonOpacity,
    horizonScale,
    onComplete,
    reduceMotion,
    violetOpacity,
    violetScale,
  ]);

  if (reduceMotion !== false) {
    return (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.container}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <View style={styles.opticalCenter}>
        <Animated.View
          style={[
            styles.field,
            {
              opacity: fieldOpacity,
              transform: [{ scale: fieldScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.violetRing,
            {
              opacity: violetOpacity,
              transform: [{ scale: violetScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.cyanRing,
            {
              opacity: cyanOpacity,
              transform: [{ scale: cyanScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.horizon,
            {
              opacity: horizonOpacity,
              transform: [{ scaleX: horizonScale }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opticalCenter: {
    width: 320,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -42 }],
  },
  field: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(124, 92, 252, 0.12)',
  },
  violetRing: {
    position: 'absolute',
    width: 184,
    height: 112,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: VIOLET,
    shadowColor: VIOLET,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  cyanRing: {
    position: 'absolute',
    width: 214,
    height: 132,
    borderRadius: 999,
    borderWidth: 1.15,
    borderColor: CYAN,
    shadowColor: CYAN,
    shadowOpacity: 0.78,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },
  horizon: {
    position: 'absolute',
    width: 124,
    height: 2,
    borderRadius: 1,
    backgroundColor: CORE,
    shadowColor: CYAN,
    shadowOpacity: 0.84,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
});
