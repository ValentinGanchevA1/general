import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/theme';

export type ButtonVariant = 'primary' | 'action' | 'secondary' | 'ghost' | 'danger';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}

const BG: Record<ButtonVariant, string> = {
  primary: colors.primary,
  action: colors.action,
  secondary: colors.bg,
  ghost: 'transparent',
  danger: colors.danger,
};

const FG: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  action: colors.onPrimary,
  secondary: colors.textSecondary,
  ghost: colors.primary,
  danger: colors.textPrimary,
};

/**
 * Shared CTA button — map sheet, profiles, forms.
 */
export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  flex = false,
}: PrimaryButtonProps): React.JSX.Element {
  const isSecondary = variant === 'secondary';
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: BG[variant] },
        isSecondary && styles.secondaryBorder,
        flex && styles.flex,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <Text style={[styles.label, { color: FG[variant] }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  flex: { flex: 1 },
  disabled: { opacity: 0.55 },
  label: { fontWeight: '700', fontSize: 15 },
});
