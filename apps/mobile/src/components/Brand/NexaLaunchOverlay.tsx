import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { nexaDark } from '@/theme';

import { NexaLaunchComposition } from './NexaLaunchComposition';
import { NEXA_LAUNCH_VISUAL } from './nexaLaunchVisual';
import { NEXA_REDUCED_MOTION_TIMING_MS as RT } from './nexaLaunchTiming';
import { resolveLaunchReduceMotion } from './resolveLaunchReduceMotion';

const EXIT_DURATION_MS = 390;

export interface NexaLaunchOverlayProps {
  ready: boolean;
  onHidden?: () => void;
}

/**
 * NEXA v5 "Radiant Eye" launch sequence.
 *
 * The native launch surface remains a blank NEXA canvas. Once React Native is
 * mounted, the pupil ignites, light constructs the eye from its optical center,
 * energy propagates into the surrounding network, entity nodes resolve, the
 * composition converges once, and the NEXA wordmark settles last.
 *
 * Boot-time readiness never controls animation speed: the finished composition
 * simply holds until auth/map launch readiness allows the overlay to dissolve.
 */
export function NexaLaunchOverlay({
  ready,
  onHidden,
}: NexaLaunchOverlayProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(true);
  const [nativeHidden, setNativeHidden] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const nativeHideStartedRef = useRef(false);
  const exitStartedRef = useRef(false);

  const exit = useSharedValue(0);

  useEffect(() => {
    let active = true;

    void resolveLaunchReduceMotion().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const hideNativeSplash = useCallback((): void => {
    if (nativeHideStartedRef.current) {
      return;
    }

    nativeHideStartedRef.current = true;

    void BootSplash.hide({ fade: false })
      .catch(() => undefined)
      .finally(() => {
        setNativeHidden(true);
      });
  }, []);

  const handleEntranceComplete = useCallback((): void => {
    setEntranceComplete(true);
  }, []);

  const finishExit = useCallback((): void => {
    setVisible(false);
    onHidden?.();
  }, [onHidden]);

  useEffect(() => {
    if (
      !visible ||
      !ready ||
      !entranceComplete ||
      reduceMotion === null ||
      exitStartedRef.current
    ) {
      return;
    }

    exitStartedRef.current = true;

    exit.value = withTiming(
      1,
      {
        duration: reduceMotion ? RT.exit : EXIT_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishExit)();
        }
      },
    );
  }, [
    entranceComplete,
    exit,
    finishExit,
    ready,
    reduceMotion,
    visible,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      exit.value,
      [0, 0.28, 1],
      [1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const compositionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      exit.value,
      [0, 0.62, 1],
      [1, 0.88, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          exit.value,
          [0, 1],
          [1, 0.985],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View
      style={styles.container}
      onLayout={hideNativeSplash}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="NEXA"
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={nexaDark.canvas}
        translucent={false}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, backdropStyle]}
      />

      {nativeHidden && reduceMotion !== null ? (
        <Animated.View style={[styles.opticalCenter, compositionStyle]}>
          <NexaLaunchComposition
            reduceMotion={reduceMotion}
            onComplete={handleEntranceComplete}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: nexaDark.canvas,
  },
  opticalCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [
      {
        translateY: NEXA_LAUNCH_VISUAL.opticalOffsetY,
      },
    ],
  },
});
