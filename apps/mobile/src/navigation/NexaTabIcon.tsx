import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';
import { NEXA_TAB_VISUALS, type NexaMainTab } from './nexaTabIdentity';

/**
 * Neon Iris navigation treatment. All five tabs retain their existing routes,
 * semantic colors and accessible labels. No map novelty/vanity badges.
 */
export function NexaTabIcon({
  tab,
  focused,
}: {
  tab: NexaMainTab;
  focused: boolean;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  const [emphasis] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      emphasis.stopAnimation();
      emphasis.setValue(focused ? 1 : 0);
      return;
    }
    const animation = Animated.timing(emphasis, {
      toValue: focused ? 1 : 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [emphasis, focused, reduceMotion]);
  const visual = NEXA_TAB_VISUALS[tab];
  const accent = visual.tone === 'discovery' ? colors.discovery : colors.actionPrimary;
  const soft = visual.tone === 'discovery' ? colors.discoverySoft : colors.actionSoft;
  const border = visual.tone === 'discovery' ? colors.discoveryBorderSoft : colors.actionBorderSoft;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.stage,
        focused
          ? { backgroundColor: soft, borderColor: border }
          : styles.inactive,
      ]}
    >
      <Animated.View
        style={[styles.halo, { backgroundColor: accent, opacity: emphasis.interpolate({
          inputRange: [0, 1], outputRange: [0, 0.12],
        }) }]}
      />
      <MaterialCommunityIcons
        name={focused ? visual.activeIcon : visual.icon}
        size={24}
        color={focused ? accent : colors.textTertiary}
      />
      <Animated.View
        style={[styles.indicator, {
          backgroundColor: accent,
          opacity: emphasis,
          transform: [{ scaleX: emphasis }],
        }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 44,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inactive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  halo: {
    position: 'absolute',
    width: 34,
    height: 30,
    borderRadius: 15,
  },
  indicator: {
    position: 'absolute',
    bottom: 1,
    width: 14,
    height: 2,
    borderRadius: 1,
  },
});
