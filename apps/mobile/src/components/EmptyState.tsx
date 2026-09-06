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
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional MCI icon name shown above the title. */
  icon?: string;
  /**
   * `card` (default) — bordered panel for map overlays.
   * `plain` — no card chrome; for full-screen list empties.
   */
  variant?: 'card' | 'plain';
  style?: StyleProp<ViewStyle>;
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
          activeOpacity={0.85}
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
    backgroundColor: 'rgba(10,10,15,0.88)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 320,
  },
  plain: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    marginTop: spacing.xl,
  },
  icon: {
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
