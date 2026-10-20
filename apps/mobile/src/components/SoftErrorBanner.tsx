import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { radius, spacing, fontSize, useAppTheme, type ThemeColors } from '@/theme';

export interface SoftErrorBannerProps {
  /** Short status line (default: couldn't refresh). */
  message?: string | undefined;
  onRetry: () => void;
  style?: StyleProp<ViewStyle> | undefined;
}

/**
 * Non-blocking banner when a keep-stale fetch fails but previous data is shown.
 * Pair with EmptyState Retry for the empty+error case.
 */
export function SoftErrorBanner({
  message = "Couldn't refresh — showing last data",
  onRetry,
  style,
}: SoftErrorBannerProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[styles.bar, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name="cloud-off-outline" size={16} color={colors.warning} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        style={styles.btn}
      >
        <Text style={styles.btnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    text: {
      flex: 1,
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    btn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    btnText: {
      color: colors.primary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  });
}
