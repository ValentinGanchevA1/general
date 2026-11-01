import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppSelector } from '@/hooks/redux';
import { useAppTheme } from '@/theme';
import { NEXA_TAB_VISUALS, type NexaMainTab } from './nexaTabIdentity';

export function NexaTabIcon({
  tab,
  focused,
}: {
  tab: NexaMainTab;
  focused: boolean;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const mapNewCount = useAppSelector((state) => state.mapNovelty.newCount);
  const visual = NEXA_TAB_VISUALS[tab];
  const accent = visual.tone === 'discovery' ? colors.discovery : colors.actionPrimary;
  const soft = visual.tone === 'discovery' ? colors.discoverySoft : colors.actionSoft;
  const border = visual.tone === 'discovery' ? colors.discoveryBorderSoft : colors.actionBorderSoft;
  const badgeCount = tab === 'Map' && !focused ? mapNewCount : 0;

  return (
    <View
      style={[
        styles.stage,
        focused
          ? { backgroundColor: soft, borderColor: border }
          : { backgroundColor: 'transparent', borderColor: 'transparent' },
      ]}
      pointerEvents="none"
    >
      <MaterialCommunityIcons
        name={focused ? visual.activeIcon : visual.icon}
        size={22}
        color={focused ? accent : colors.textTertiary}
      />
      {badgeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={[styles.badgeText, { color: colors.canvas }]}>
            {badgeCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 38,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
