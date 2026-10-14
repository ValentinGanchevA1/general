import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export interface AppScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Apply safe-area padding on edges. Default: top only (headers often own top). */
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  /** Use surface instead of bg (modals / nested). */
  surface?: boolean;
}

/**
 * Root screen shell: themed background + optional safe-area padding.
 * Does not replace navigation headers — compose with ScreenHeader / AppHeader.
 */
export function AppScreen({
  children,
  style,
  edges = ['top'],
  surface = false,
}: AppScreenProps): React.JSX.Element {
  const { colors, layout } = useAppTheme();
  const insets = useSafeAreaInsets();

  const pad: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? Math.max(insets.left, layout.screenPaddingH) : 0,
    paddingRight: edges.includes('right') ? Math.max(insets.right, layout.screenPaddingH) : 0,
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: surface ? colors.surface : colors.bg },
        pad,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
