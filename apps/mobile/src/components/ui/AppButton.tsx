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

/**
 * Themed button — height ~50, min touch 44.
 * Variants map to brand tokens (primary cyan, action green, danger).
 */
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
  const { colors, radius, fontSize, layout } = useAppTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'action'
        ? colors.action
        : variant === 'danger'
          ? colors.dangerSolid
          : variant === 'secondary'
            ? colors.surfaceRaised
            : 'transparent';

  const fg =
    variant === 'primary' || variant === 'action' || variant === 'danger'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.textPrimary
        : colors.primary;

  const border =
    variant === 'ghost' || variant === 'secondary'
      ? { borderWidth: 1, borderColor: colors.borderStrong }
      : undefined;

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
          borderRadius: radius.md,
          backgroundColor: bg,
          opacity: isDisabled ? 0.45 : pressed ? 0.88 : 1,
        },
        border,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[{ color: fg, fontSize: fontSize.md, fontWeight: '700' }, textStyle]}>
          {label}
        </Text>
      )}
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
