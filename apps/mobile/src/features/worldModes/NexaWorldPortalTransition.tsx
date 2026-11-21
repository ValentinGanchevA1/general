import React, { useEffect, useState } from 'react';
import { Animated, Easing, StatusBar, StyleSheet, Text, View } from 'react-native';

import { resolveLaunchReduceMotion } from '@/components/Brand/resolveLaunchReduceMotion';
import { nexaDark } from '@/theme';

import { WORLD_MODES, type WorldModeId } from './worldModes';
import { worldModePalettes } from '@/theme/worldModePalettes';

export interface NexaWorldPortalTransitionProps {
  worldId: WorldModeId;
  onComplete: () => void;
}

/**
 * A short, world-specific portal reveal shown after the first-run choice has
 * been persisted. It is intentionally separate from the cold-start Radiant Eye
 * so physical launch calibration (#669) and its timings remain untouched.
 */
export function NexaWorldPortalTransition({
  worldId,
  onComplete,
}: NexaWorldPortalTransitionProps): React.JSX.Element {
  const palette = worldModePalettes[worldId];
  const world = WORLD_MODES[worldId];
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;

    void resolveLaunchReduceMotion().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        onComplete();
        return;
      }

      animation = Animated.timing(progress, {
        toValue: 1,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished && !cancelled) onComplete();
      });
    });

    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [onComplete, progress]);

  const outerRingStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.18, 0.72, 1],
      outputRange: [0.08, 0.78, 0.5, 0],
    }),
    transform: [{
      scale: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.72, 2.75],
      }),
    }],
  };

  const innerRingStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.22, 0.78, 1],
      outputRange: [0.12, 0.7, 0.36, 0],
    }),
    transform: [{
      scale: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.58, 2.1],
      }),
    }],
  };

  const coreStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.22, 0.8, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [{
      scale: progress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0.72, 1, 0.94],
      }),
    }],
  };

  const labelStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.25, 0.72, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [{
      translateY: progress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [10, 0, -5],
      }),
    }],
  };

  return (
    <View
      style={styles.root}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel={'Entering ' + world.label}
    >
      <StatusBar barStyle="light-content" backgroundColor={nexaDark.canvas} />
      <View pointerEvents="none" style={styles.stage}>
        <Animated.View
          style={[
            styles.outerRing,
            { borderColor: palette.accent, shadowColor: palette.accent },
            outerRingStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.innerRing,
            { borderColor: palette.secondary, shadowColor: palette.secondary },
            innerRingStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.core,
            { backgroundColor: palette.glow, borderColor: palette.accent },
            coreStyle,
          ]}
        >
          <Text style={[styles.symbol, { color: palette.accent }]}>{world.symbol}</Text>
        </Animated.View>
        <Animated.View style={[styles.copy, labelStyle]}>
          <Text style={[styles.eyebrow, { color: palette.secondary }]}>NEXUS WORLDS 2.0</Text>
          <Text style={styles.title}>ENTERING {world.label.toUpperCase()}</Text>
          <Text style={styles.subtitle}>Your world is ready</Text>
          <View style={[styles.flare, { backgroundColor: palette.accent }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12000,
    elevation: 12000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: nexaDark.canvas,
  },
  stage: {
    width: 340,
    height: 390,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.5,
    shadowOpacity: 0.75,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  innerRing: {
    position: 'absolute',
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 1.5,
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
  core: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    fontSize: 42,
    fontWeight: '700',
  },
  copy: {
    position: 'absolute',
    top: 294,
    left: 8,
    right: 8,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  title: {
    marginTop: 9,
    color: nexaDark.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 7,
    color: nexaDark.textSecondary,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  flare: {
    marginTop: 16,
    width: 58,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
  },
});
