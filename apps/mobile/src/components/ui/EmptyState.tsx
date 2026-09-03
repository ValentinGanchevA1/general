import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, radius, spacing } from '@/theme';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/**
 * Shared empty / sparse state used on Map, lists, and inboxes.
 */
export function EmptyState({
  icon = 'map-marker-off-outline',
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  style,
  compact = false,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={[styles.wrap, compact && styles.compact, style]} accessibilityRole="summary">
      <Icon name={icon} size={compact ? 28 : 40} color={colors.textFaint} />
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.primary} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.primaryText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <TouchableOpacity onPress={onSecondary} style={styles.secondary}>
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  compact: {
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleCompact: { fontSize: 14 },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  primary: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  secondary: { marginTop: spacing.xs, padding: spacing.sm },
  secondaryText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
