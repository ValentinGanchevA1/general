import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';
import { nexusVisual } from '@/theme/nexusVisual';

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
  const { colors, layout, mode, shadow } = useAppTheme();
  const isNexus = mode === 'protos-nexus';

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
          borderRadius: isNexus ? nexusVisual.radius.control : 0,
          backgroundColor: isNexus ? colors.surfaceRaised : 'transparent',
          borderWidth: isNexus ? nexusVisual.borderWidth : 0,
          borderColor: isNexus ? colors.border : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
        },
        isNexus && !disabled ? shadow(0.1) : null,
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? (isNexus ? colors.primary : colors.textPrimary)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
