import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export interface AppCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Slightly raised surface (default true). */
  elevated?: boolean;
  accessibilityLabel?: string;
}

export function AppCard({
  children,
  onPress,
  style,
  elevated = true,
  accessibilityLabel,
}: AppCardProps): React.JSX.Element {
  const { colors, radius, layout, shadow } = useAppTheme();

  const baseStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: elevated ? colors.surface : colors.surfaceRaised,
      borderRadius: radius.card ?? layout.cardRadius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    elevated ? shadow(0.12) : null,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.92 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}
