import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BootSplash from 'react-native-bootsplash';

import { NexaSymbol } from './NexaSymbol';

const SPLASH_BACKGROUND = '#08090D';
const WORDMARK = '#F7F8FA';
const DISCOVERY_CYAN = '#27D3F2';

export interface NexaLaunchOverlayProps {
  ready: boolean;
  onHidden?: () => void;
}

/**
 * Runtime half of the NEXA launch sequence.
 * Native splash stays static; once RN has committed, this overlay takes over
 * pixel-continuously and performs the short wordmark -> discovery pulse -> app handoff.
 */
export function NexaLaunchOverlay({
  ready,
  onHidden,
}: NexaLaunchOverlayProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(true);
  const [nativeHidden, setNativeHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const nativeHideStartedRef = useRef(false);
  const animationStartedRef = useRef(false);

  // Animated values are stable component state. Using lazy state initializers avoids
  // reading ref.current during render, which is forbidden by React 19's refs lint rule.
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [wordmarkOpacity] = useState(() => new Animated.Value(1));
  const [symbolScale] = useState(() => new Animated.Value(1));
  const [pulseScale] = useState(() => new Animated.Value(0.55));
  const [pulseOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const hideNativeSplash = useCallback((): void => {
    if (nativeHideStartedRef.current) return;
    nativeHideStartedRef.current = true;

    void BootSplash.hide({ fade: false })
      .catch(() => undefined)
      .finally(() => setNativeHidden(true));
  }, []);

  useEffect(() => {
    if (
      !visible ||
      !ready ||
      !nativeHidden ||
      reduceMotion === null ||
      animationStartedRef.current
    ) {
      return;
    }

    animationStartedRef.current = true;

    const animation = reduceMotion
      ? Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      : Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(80),
            Animated.timing(symbolScale, {
              toValue: 0.92,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(160),
            Animated.parallel([
              Animated.sequence([
                Animated.timing(pulseOpacity, {
                  toValue: 0.38,
                  duration: 24,
                  useNativeDriver: true,
                }),
                Animated.timing(pulseOpacity, {
                  toValue: 0,
                  duration: 236,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
              Animated.timing(pulseScale, {
                toValue: 1.45,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.sequence([
            Animated.delay(360),
            Animated.timing(overlayOpacity, {
              toValue: 0,
              duration: 120,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]);

    animation.start(({ finished }) => {
      if (!finished) return;
      setVisible(false);
      onHidden?.();
    });

    return () => animation.stop();
  }, [
    nativeHidden,
    onHidden,
    overlayOpacity,
    pulseOpacity,
    pulseScale,
    ready,
    reduceMotion,
    symbolScale,
    visible,
    wordmarkOpacity,
  ]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity: overlayOpacity }]}
      onLayout={hideNativeSplash}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="NEXA"
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={SPLASH_BACKGROUND}
        translucent={false}
      />

      <View style={styles.center}>
        <View style={styles.symbolStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulse,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />

          <Animated.View style={{ transform: [{ scale: symbolScale }] }}>
            <NexaSymbol size={96} />
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: wordmarkOpacity }}>
          <Text style={styles.wordmark} accessibilityElementsHidden>
            NEXA
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BACKGROUND,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -20 }],
  },
  symbolStage: {
    width: 220,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
    borderColor: DISCOVERY_CYAN,
    shadowColor: DISCOVERY_CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  wordmark: {
    marginTop: 2,
    color: WORDMARK,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 8,
    lineHeight: 34,
    textAlign: 'center',
  },
});
