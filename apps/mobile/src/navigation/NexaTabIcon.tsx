import React from 'react';
import { StyleSheet, View } from 'react-native';
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
      {focused ? (
        <View style={[styles.halo, { backgroundColor: accent, opacity: 0.12 }]} />
      ) : null}
      <MaterialCommunityIcons
        name={focused ? visual.activeIcon : visual.icon}
        size={24}
        color={focused ? accent : colors.textTertiary}
      />
      {focused ? (
        <View style={[styles.indicator, { backgroundColor: accent }]} />
      ) : null}
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
