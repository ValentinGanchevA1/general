import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { nexusVisual } from '@/theme/nexusVisual';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'action';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: AppButtonProps): React.JSX.Element {
  const { colors, radius, fontSize, layout, mode, shadow } = useAppTheme();
  const isDisabled = disabled || loading;
  const isNexus = mode === 'protos-nexus';
  const isEmphasized = variant === 'primary' || variant === 'action';

  const bg = variant === 'primary' ? colors.primary : variant === 'action' ? colors.action : variant === 'danger' ? colors.dangerSolid : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const fg = variant === 'primary' || variant === 'action' || variant === 'danger' ? colors.onPrimary : variant === 'secondary' ? colors.textPrimary : colors.primary;
  const hasBorder = variant === 'ghost' || variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: layout.buttonHeight,
          borderRadius: isNexus ? nexusVisual.radius.control : radius.md,
          backgroundColor: bg,
          opacity: isDisabled ? 0.45 : pressed ? 0.88 : 1,
          borderWidth: hasBorder ? (isNexus ? nexusVisual.borderWidth : 1) : 0,
          borderColor: hasBorder ? colors.borderStrong : 'transparent',
        },
        isNexus && isEmphasized && !isDisabled ? shadow(0.2) : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[{ color: fg, fontSize: fontSize.md, fontWeight: '700' }, textStyle]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
