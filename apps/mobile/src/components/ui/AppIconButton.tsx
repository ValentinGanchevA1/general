import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

export interface AppIconButtonProps {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/** 44×44 icon-only control — requires accessibilityLabel. */
export function AppIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 24,
  color,
  style,
  disabled = false,
}: AppIconButtonProps): React.JSX.Element {
  const { colors, layout } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          width: layout.minTouch,
          height: layout.minTouch,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
