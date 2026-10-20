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
 * pixel-continuously and performs the branded discovery -> world -> live-app handoff.
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

  // Animated values are stable component state. Lazy state initializers avoid
  // render-time ref.current access under React 19's refs lint rule.
  const [backdropOpacity] = useState(() => new Animated.Value(1));
  const [brandOpacity] = useState(() => new Animated.Value(1));
  const [wordmarkOpacity] = useState(() => new Animated.Value(1));
  const [symbolScale] = useState(() => new Animated.Value(1));
  const [brandTranslateY] = useState(() => new Animated.Value(0));

  const [primaryPulseScale] = useState(() => new Animated.Value(0.46));
  const [primaryPulseOpacity] = useState(() => new Animated.Value(0));
  const [secondaryPulseScale] = useState(() => new Animated.Value(0.38));
  const [secondaryPulseOpacity] = useState(() => new Animated.Value(0));
  const [settleHaloScale] = useState(() => new Animated.Value(0.72));
  const [settleHaloOpacity] = useState(() => new Animated.Value(0));

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

    const reducedMotionAnimation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(brandOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const fullMotionAnimation = Animated.parallel([
      // Step 2 -> 3: clear the wordmark first so the symbol becomes the focus.
      Animated.timing(wordmarkOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(70),
        Animated.timing(symbolScale, {
          toValue: 0.94,
          duration: 170,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Step 3: two staggered discovery rings make the signal feel spatial,
      // rather than like a single loading pulse.
      Animated.sequence([
        Animated.delay(130),
        Animated.parallel([
          Animated.timing(primaryPulseScale, {
            toValue: 2.7,
            duration: 440,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(primaryPulseOpacity, {
              toValue: 0.46,
              duration: 45,
              useNativeDriver: true,
            }),
            Animated.timing(primaryPulseOpacity, {
              toValue: 0,
              duration: 395,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(secondaryPulseScale, {
            toValue: 2.15,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(secondaryPulseOpacity, {
              toValue: 0.24,
              duration: 35,
              useNativeDriver: true,
            }),
            Animated.timing(secondaryPulseOpacity, {
              toValue: 0,
              duration: 325,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),

      // Step 4: reveal the already-mounted app by fading only the dark backdrop.
      // The discovery rings remain visible over the map for continuity.
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.timing(brandOpacity, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(brandTranslateY, {
            toValue: -14,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(symbolScale, {
            toValue: 0.82,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Step 5: one soft finishing halo settles over the live app, then disappears.
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(settleHaloScale, {
            toValue: 1.45,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(settleHaloOpacity, {
              toValue: 0.13,
              duration: 60,
              useNativeDriver: true,
            }),
            Animated.timing(settleHaloOpacity, {
              toValue: 0,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    ]);

    const animation = reduceMotion
      ? reducedMotionAnimation
      : fullMotionAnimation;

    animation.start(({ finished }) => {
      if (!finished) return;
      setVisible(false);
      onHidden?.();
    });

    return () => animation.stop();
  }, [
    backdropOpacity,
    brandOpacity,
    brandTranslateY,
    nativeHidden,
    onHidden,
    primaryPulseOpacity,
    primaryPulseScale,
    ready,
    reduceMotion,
    secondaryPulseOpacity,
    secondaryPulseScale,
    settleHaloOpacity,
    settleHaloScale,
    symbolScale,
    visible,
    wordmarkOpacity,
  ]);

  if (!visible) return null;

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
        backgroundColor={SPLASH_BACKGROUND}
        translucent={false}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      />

      <View pointerEvents="none" style={styles.haloStage}>
        <Animated.View
          style={[
            styles.settleHalo,
            {
              opacity: settleHaloOpacity,
              transform: [{ scale: settleHaloScale }],
            },
          ]}
        />
      </View>

      <View style={styles.opticalCenter}>
        <Animated.View
          style={[
            styles.center,
            {
              opacity: brandOpacity,
              transform: [{ translateY: brandTranslateY }],
            },
          ]}
        >
          <View style={styles.symbolStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulse,
                styles.primaryPulse,
                {
                  opacity: primaryPulseOpacity,
                  transform: [{ scale: primaryPulseScale }],
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulse,
                styles.secondaryPulse,
                {
                  opacity: secondaryPulseOpacity,
                  transform: [{ scale: secondaryPulseScale }],
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
        </Animated.View>
      </View>
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
    backgroundColor: SPLASH_BACKGROUND,
  },
  opticalCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -20 }],
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloStage: {
    ...StyleSheet.absoluteFillObject,
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
    borderColor: DISCOVERY_CYAN,
    shadowColor: DISCOVERY_CYAN,
    shadowOffset: { width: 0, height: 0 },
  },
  primaryPulse: {
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
    shadowOpacity: 0.46,
    shadowRadius: 14,
  },
  secondaryPulse: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },
  settleHalo: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: DISCOVERY_CYAN,
    shadowColor: DISCOVERY_CYAN,
    shadowOpacity: 0.18,
    shadowRadius: 18,
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
