import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, radius, spacing } from '@/theme';

export interface EmptyStateProps {
  title: string;
  body?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  /** Optional MCI icon name shown above the title. */
  icon?: string | undefined;
  /**
   * `card` (default) — bordered panel for map overlays.
   * `plain` — no card chrome; for full-screen list empties.
   */
  variant?: 'card' | 'plain' | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

/**
 * Shared empty / sparse state for map overlays and list screens.
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  icon,
  variant = 'card',
  style,
}: EmptyStateProps): React.JSX.Element {
  const plain = variant === 'plain';

  return (
    <View
      style={[plain ? styles.plain : styles.card, style]}
      accessibilityRole="summary"
    >
      {icon ? (
        <Icon
          name={icon}
          size={plain ? 48 : 32}
          color={plain ? colors.borderStrong : colors.textMuted}
          style={styles.icon}
        />
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  plain: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: { marginBottom: spacing.xs },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  btn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  btnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
