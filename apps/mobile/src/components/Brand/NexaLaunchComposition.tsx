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
      opacity: 0.08 + pulse * 0.38,
      transform: [{ scale: 1 + pulse * 0.11 }],
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
      transform: [{ translateY: 4 * (1 - reveal) }],
    };
  });

  return (
    <Animated.View style={[styles.stage, containerStyle]}>
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
        <Text style={styles.wordmark} accessibilityElementsHidden>
          NEXA
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 340,
    height: 318,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convergenceAura: {
    position: 'absolute',
    top: 48,
    width: 205,
    height: 205,
    borderRadius: 102.5,
    backgroundColor: 'rgba(124,92,252,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,190,255,0.24)',
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
    top: 54,
    width: NEXA_LAUNCH_VISUAL.symbolSize,
    height: NEXA_LAUNCH_VISUAL.symbolSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkWrap: {
    position: 'absolute',
    top: 246,
    alignItems: 'center',
  },
  wordmark: {
    color: nexaDark.textPrimary,
    fontSize: NEXA_LAUNCH_VISUAL.wordmarkSize,
    fontWeight: '400',
    lineHeight: 37,
    letterSpacing: NEXA_LAUNCH_VISUAL.wordmarkTracking,
    textAlign: 'center',
    textShadowColor: 'rgba(146,120,255,0.26)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
});
