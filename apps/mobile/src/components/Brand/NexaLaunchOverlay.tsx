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
import LinearGradient from 'react-native-linear-gradient';
import BootSplash from 'react-native-bootsplash';

import { NexaSymbol } from './NexaSymbol';

const SPLASH_BACKGROUND = '#08090D';
const WORDMARK = '#F7F8FA';
const VIOLET = '#7C5CFC';
const VIOLET_BRIGHT = '#9278FF';
const SYMBOL_CORE = '#C8BEFF';
const CYAN = '#27D3F2';
const CYAN_BRIGHT = '#62E6FF';

const ENTER_DURATION_MS = 1180;
const EXIT_DURATION_MS = 520;

export interface NexaLaunchOverlayProps {
  ready: boolean;
  onHidden?: () => void;
}

/**
 * NEXA v3 launch sequence.
 *
 * Native launch is intentionally only the dark canvas. Once RN has mounted,
 * the eye core ignites, the entity orbit refills with light, NEXA's entity
 * glyphs resolve on the orbit, and the wordmark fades in. When boot-time auth
 * restoration is complete, the whole system dissolves into the live app.
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
  const entranceStartedRef = useRef(false);
  const exitStartedRef = useRef(false);

  const [backdropOpacity] = useState(() => new Animated.Value(1));
  const [brandOpacity] = useState(() => new Animated.Value(0));
  const [brandScale] = useState(() => new Animated.Value(0.82));
  const [brandTranslateY] = useState(() => new Animated.Value(8));
  const [wordmarkOpacity] = useState(() => new Animated.Value(0));
  const [wordmarkTranslateY] = useState(() => new Animated.Value(8));

  const [orbitOpacity] = useState(() => new Animated.Value(0));
  const [orbitScale] = useState(() => new Animated.Value(0.72));
  const [orbitRotation] = useState(() => new Animated.Value(0));
  const [entitiesOpacity] = useState(() => new Animated.Value(0));
  const [entitiesScale] = useState(() => new Animated.Value(0.68));

  const [rayOpacity] = useState(() => new Animated.Value(0));
  const [rayScale] = useState(() => new Animated.Value(0.12));
  const [streakOpacity] = useState(() => new Animated.Value(0));
  const [streakSweep] = useState(() => new Animated.Value(0));
  const [flashOpacity] = useState(() => new Animated.Value(0));
  const [flashScale] = useState(() => new Animated.Value(0.72));

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
      !nativeHidden ||
      reduceMotion === null ||
      entranceStartedRef.current
    ) {
      return;
    }

    entranceStartedRef.current = true;

    const reducedMotionAnimation = Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(wordmarkOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(orbitOpacity, {
        toValue: 0.74,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(entitiesOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const fullMotionAnimation = Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(brandScale, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(brandTranslateY, {
        toValue: 0,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(110),
        Animated.parallel([
          Animated.timing(orbitOpacity, {
            toValue: 0.88,
            duration: 440,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(orbitScale, {
            toValue: 1,
            duration: 640,
            easing: Easing.out(Easing.back(1.04)),
            useNativeDriver: true,
          }),
          Animated.timing(orbitRotation, {
            toValue: 1,
            duration: 880,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(entitiesOpacity, {
            toValue: 1,
            duration: 290,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(entitiesScale, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.back(1.35)),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(70),
        Animated.parallel([
          Animated.timing(rayOpacity, {
            toValue: 0.9,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(rayScale, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rayOpacity, {
          toValue: 0,
          duration: 430,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(streakOpacity, {
          toValue: 1,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(streakSweep, {
            toValue: 1,
            duration: 660,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(430),
            Animated.timing(streakOpacity, {
              toValue: 0,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(210),
        Animated.parallel([
          Animated.timing(flashOpacity, {
            toValue: 0.62,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flashScale, {
            toValue: 1.08,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(610),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkTranslateY, {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    const animation = reduceMotion
      ? reducedMotionAnimation
      : fullMotionAnimation;

    animation.start(({ finished }) => {
      if (!finished) return;
      setEntranceComplete(true);
    });

    return () => animation.stop();
  }, [
    brandOpacity,
    brandScale,
    brandTranslateY,
    entitiesOpacity,
    entitiesScale,
    flashOpacity,
    flashScale,
    nativeHidden,
    orbitOpacity,
    orbitRotation,
    orbitScale,
    rayOpacity,
    rayScale,
    reduceMotion,
    streakOpacity,
    streakSweep,
    visible,
    wordmarkOpacity,
    wordmarkTranslateY,
  ]);

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

    const reducedMotionAnimation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(brandOpacity, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const fullMotionAnimation = Animated.parallel([
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(wordmarkOpacity, {
          toValue: 0,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(entitiesOpacity, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(orbitOpacity, {
            toValue: 0,
            duration: 310,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(orbitScale, {
            toValue: 1.08,
            duration: 320,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(190),
        Animated.parallel([
          Animated.timing(brandOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(brandScale, {
            toValue: 0.95,
            duration: 300,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(brandTranslateY, {
            toValue: -10,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(EXIT_DURATION_MS - 260),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
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
    brandScale,
    brandTranslateY,
    entranceComplete,
    entitiesOpacity,
    onHidden,
    orbitOpacity,
    orbitScale,
    ready,
    reduceMotion,
    visible,
    wordmarkOpacity,
  ]);

  if (!visible) return null;

  const orbitRotate = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['-17deg', '7deg'],
  });
  const streakRotate = streakSweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['-72deg', '34deg'],
  });

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

      <Animated.View
        pointerEvents="none"
        style={[
          styles.rayStage,
          {
            opacity: rayOpacity,
            transform: [{ scaleX: rayScale }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(124,92,252,0.70)', 'rgba(247,248,250,0.98)', 'rgba(39,211,242,0.64)', 'transparent']}
          locations={[0, 0.28, 0.5, 0.72, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.rayHorizontal}
        />
        <View style={[styles.rayDiagonalWrap, styles.rayDiagonalLeft]}>
          <LinearGradient
            colors={['transparent', 'rgba(146,120,255,0.74)', 'rgba(247,248,250,0.96)', 'transparent']}
            locations={[0, 0.34, 0.55, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rayDiagonal}
          />
        </View>
        <View style={[styles.rayDiagonalWrap, styles.rayDiagonalRight]}>
          <LinearGradient
            colors={['transparent', 'rgba(98,230,255,0.64)', 'rgba(247,248,250,0.94)', 'transparent']}
            locations={[0, 0.38, 0.56, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rayDiagonal}
          />
        </View>
      </Animated.View>

      <View style={styles.opticalCenter}>
        <Animated.View
          style={[
            styles.brand,
            {
              opacity: brandOpacity,
              transform: [
                { translateY: brandTranslateY },
                { scale: brandScale },
              ],
            },
          ]}
        >
          <View style={styles.markStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.flash,
                {
                  opacity: flashOpacity,
                  transform: [{ scale: flashScale }],
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.orbitSystem,
                {
                  opacity: orbitOpacity,
                  transform: [
                    { rotateZ: orbitRotate },
                    { scale: orbitScale },
                  ],
                },
              ]}
            >
              <View style={styles.orbitOuter} />
              <View style={styles.orbitInner} />

              <Animated.View
                style={[
                  styles.entityLayer,
                  {
                    opacity: entitiesOpacity,
                    transform: [{ scale: entitiesScale }],
                  },
                ]}
              >
                <View style={[styles.entitySlot, styles.entityCircleSlot]}>
                  <View style={styles.entityCircleGlow} />
                  <View style={styles.entityCircle} />
                </View>

                <View style={[styles.entitySlot, styles.entityStarSlot]}>
                  <View style={styles.starVertical} />
                  <View style={styles.starHorizontal} />
                  <View style={styles.starCore} />
                </View>

                <View style={[styles.entitySlot, styles.entitySquareSlot]}>
                  <View style={styles.entitySquareGlow} />
                  <View style={styles.entitySquare} />
                </View>

                <View style={[styles.entitySlot, styles.entityPinSlot]}>
                  <View style={styles.pinGlow} />
                  <View style={styles.pinHead}>
                    <View style={styles.pinHole} />
                  </View>
                  <View style={styles.pinTail} />
                </View>
              </Animated.View>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.streakRotor,
                {
                  opacity: streakOpacity,
                  transform: [{ rotateZ: streakRotate }],
                },
              ]}
            >
              <LinearGradient
                colors={['transparent', VIOLET_BRIGHT, '#FFFFFF', CYAN_BRIGHT, 'transparent']}
                locations={[0, 0.28, 0.52, 0.72, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.streakHead}
              />
            </Animated.View>

            <View style={styles.symbolHaloOuter} />
            <View style={styles.symbolHaloInner} />
            <NexaSymbol size={146} />
          </View>

          <Animated.View
            style={{
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkTranslateY }],
            }}
          >
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
    transform: [{ translateY: -42 }],
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markStage: {
    width: 340,
    height: 268,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    position: 'absolute',
    width: 206,
    height: 206,
    borderRadius: 103,
    backgroundColor: 'rgba(200, 190, 255, 0.17)',
    borderWidth: 1,
    borderColor: 'rgba(247, 248, 250, 0.34)',
    shadowColor: SYMBOL_CORE,
    shadowOpacity: 0.88,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 0 },
  },
  symbolHaloOuter: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.13)',
  },
  symbolHaloInner: {
    position: 'absolute',
    width: 162,
    height: 162,
    borderRadius: 81,
    borderWidth: 1,
    borderColor: 'rgba(98, 230, 255, 0.10)',
  },
  orbitSystem: {
    position: 'absolute',
    width: 320,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitOuter: {
    position: 'absolute',
    width: 314,
    height: 154,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(146, 120, 255, 0.56)',
    transform: [{ rotateZ: '-7deg' }],
    shadowColor: VIOLET_BRIGHT,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  orbitInner: {
    position: 'absolute',
    width: 300,
    height: 112,
    borderRadius: 999,
    borderWidth: 1.1,
    borderColor: 'rgba(98, 230, 255, 0.40)',
    transform: [{ rotateZ: '8deg' }],
  },
  entityLayer: {
    position: 'absolute',
    width: 320,
    height: 210,
  },
  entitySlot: {
    position: 'absolute',
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityCircleSlot: {
    left: 38,
    top: 24,
  },
  entityStarSlot: {
    right: 28,
    top: 42,
  },
  entitySquareSlot: {
    right: 56,
    bottom: 26,
  },
  entityPinSlot: {
    left: 34,
    bottom: 22,
  },
  entityCircleGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 92, 252, 0.16)',
  },
  entityCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: SYMBOL_CORE,
    borderWidth: 1,
    borderColor: 'rgba(247, 248, 250, 0.94)',
    shadowColor: VIOLET_BRIGHT,
    shadowOpacity: 1,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  starVertical: {
    position: 'absolute',
    width: 5,
    height: 26,
    borderRadius: 3,
    backgroundColor: '#F7F8FA',
    shadowColor: VIOLET_BRIGHT,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  starHorizontal: {
    position: 'absolute',
    width: 26,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F7F8FA',
  },
  starCore: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: SYMBOL_CORE,
  },
  entitySquareGlow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(39, 211, 242, 0.10)',
  },
  entitySquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: SYMBOL_CORE,
    backgroundColor: 'rgba(124, 92, 252, 0.25)',
    shadowColor: CYAN_BRIGHT,
    shadowOpacity: 0.9,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  pinGlow: {
    position: 'absolute',
    width: 28,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 92, 252, 0.11)',
  },
  pinHead: {
    position: 'absolute',
    top: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: SYMBOL_CORE,
    backgroundColor: 'rgba(8, 9, 13, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: VIOLET_BRIGHT,
    shadowOpacity: 0.92,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  pinHole: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SYMBOL_CORE,
  },
  pinTail: {
    position: 'absolute',
    top: 22,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: SYMBOL_CORE,
  },
  streakRotor: {
    position: 'absolute',
    width: 318,
    height: 210,
    alignItems: 'center',
  },
  streakHead: {
    position: 'absolute',
    top: 24,
    width: 96,
    height: 3,
    borderRadius: 2,
    shadowColor: '#FFFFFF',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  rayStage: {
    position: 'absolute',
    width: 380,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -42 }],
  },
  rayHorizontal: {
    position: 'absolute',
    width: 370,
    height: 2,
    borderRadius: 1,
  },
  rayDiagonalWrap: {
    position: 'absolute',
    width: 330,
    height: 2,
  },
  rayDiagonal: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
  },
  rayDiagonalLeft: {
    transform: [{ rotateZ: '18deg' }],
  },
  rayDiagonalRight: {
    transform: [{ rotateZ: '-18deg' }],
  },
  wordmark: {
    marginTop: -6,
    color: WORDMARK,
    fontSize: 29,
    fontWeight: '400',
    letterSpacing: 9,
    lineHeight: 38,
    textAlign: 'center',
    textShadowColor: 'rgba(146, 120, 255, 0.48)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

void ENTER_DURATION_MS;
