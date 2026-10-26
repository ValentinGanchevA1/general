import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

import { NexaAnimatedSymbol } from './NexaAnimatedSymbol';
import { NexaLaunchOrbit } from './NexaLaunchOrbit';
import { NEXA_LAUNCH_VISUAL } from './nexaLaunchVisual';
import {
  launchTime,
  NEXA_LAUNCH_TIMING_MS as T,
  NEXA_REDUCED_MOTION_TIMING_MS as RT,
} from './nexaLaunchTiming';

export interface NexaLaunchCompositionProps {
  reduceMotion: boolean;
  onComplete: () => void;
}

export function NexaLaunchComposition({
  reduceMotion,
  onComplete,
}: NexaLaunchCompositionProps): React.JSX.Element {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const containerOpacity = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    if (reduceMotion) {
      containerOpacity.value = withTiming(
        1,
        {
          duration: RT.entranceComplete,
          easing: Easing.out(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        },
      );
      return;
    }

    progress.value = withTiming(
      1,
      {
        duration: T.entranceComplete,
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      },
    );
  }, [containerOpacity, onComplete, progress, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const ambientAuraStyle = useAnimatedStyle(() => {
    const reveal = interpolate(
      progress.value,
      [launchTime(T.pupilIgnition), launchTime(T.orbitComplete)],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: 0.04 + reveal * 0.12,
      transform: [{ scale: 0.86 + reveal * 0.14 }],
    };
  });

  const convergenceAuraStyle = useAnimatedStyle(() => {
    const pulse = interpolate(
      progress.value,
      [
        launchTime(T.convergenceStart),
        launchTime(T.convergencePeak),
        launchTime(T.convergenceEnd),
      ],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity: 0.1 + pulse * 0.42,
      transform: [{ scale: 1 + pulse * 0.12 }],
    };
  });

  const symbolStyle = useAnimatedStyle(() => {
    const pulse = interpolate(
      progress.value,
      [
        launchTime(T.convergenceStart),
        launchTime(T.convergencePeak),
        launchTime(T.convergenceEnd),
      ],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        {
          scale:
            1 +
            pulse * (NEXA_LAUNCH_VISUAL.pulseScale - 1),
        },
      ],
    };
  });

  const wordmarkStyle = useAnimatedStyle(() => {
    const reveal = interpolate(
      progress.value,
      [launchTime(T.wordmarkReveal), launchTime(T.wordmarkComplete)],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: reveal,
      transform: [
        { translateY: 7 * (1 - reveal) },
        { scale: 0.985 + reveal * 0.015 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.stage, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ambientAura, ambientAuraStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.convergenceAura, convergenceAuraStyle]}
      />

      <View pointerEvents="none" style={styles.orbitLayer}>
        <NexaLaunchOrbit progress={progress} layer="back" />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.symbolStage, symbolStyle]}
      >
        <NexaAnimatedSymbol progress={progress} />
      </Animated.View>

      <View pointerEvents="none" style={styles.orbitLayer}>
        <NexaLaunchOrbit progress={progress} layer="front" />
      </View>

      <Animated.View style={[styles.wordmarkWrap, wordmarkStyle]}>
        <Text
          style={[styles.wordmark, styles.wordmarkBloom]}
          accessibilityElementsHidden
        >
          NEXA
        </Text>
        <Text style={styles.wordmark} accessibilityElementsHidden>
          NEXA
        </Text>
        <View style={styles.wordmarkFlare} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 360,
    height: 338,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientAura: {
    position: 'absolute',
    top: 20,
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(57,46,145,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(98,230,255,0.08)',
  },
  convergenceAura: {
    position: 'absolute',
    top: 48,
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: 'rgba(124,92,252,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(214,205,255,0.32)',
  },
  orbitLayer: {
    position: 'absolute',
    top: 0,
    width: 340,
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolStage: {
    position: 'absolute',
    top: 47,
    width: NEXA_LAUNCH_VISUAL.symbolSize,
    height: NEXA_LAUNCH_VISUAL.symbolSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkWrap: {
    position: 'absolute',
    top: 258,
    minWidth: 230,
    alignItems: 'center',
  },
  wordmark: {
    color: '#F7F4FF',
    fontSize: NEXA_LAUNCH_VISUAL.wordmarkSize,
    fontWeight: '400',
    lineHeight: 39,
    letterSpacing: NEXA_LAUNCH_VISUAL.wordmarkTracking,
    textAlign: 'center',
    textShadowColor: 'rgba(174,151,255,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  wordmarkBloom: {
    position: 'absolute',
    color: nexaDark.textPrimary,
    opacity: 0.3,
    textShadowColor: 'rgba(124,92,252,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  wordmarkFlare: {
    marginTop: 8,
    width: 62,
    height: 1,
    backgroundColor: 'rgba(146,120,255,0.36)',
    shadowColor: '#9278FF',
    shadowOpacity: 0.8,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});
