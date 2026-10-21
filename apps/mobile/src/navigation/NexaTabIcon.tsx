import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
  const visual = NEXA_TAB_VISUALS[tab];
  const accent = visual.tone === 'discovery' ? colors.discovery : colors.actionPrimary;
  const soft = visual.tone === 'discovery' ? colors.discoverySoft : colors.actionSoft;
  const border = visual.tone === 'discovery' ? colors.discoveryBorderSoft : colors.actionBorderSoft;

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
  },
});
