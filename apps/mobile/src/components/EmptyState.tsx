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

import { radius, spacing, useAppTheme } from '@/theme';

export interface EmptyStateProps {
  title: string;
  body?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  icon?: string | undefined;
  variant?: 'card' | 'plain' | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  icon,
  variant = 'card',
  style,
}: EmptyStateProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const plain = variant === 'plain';

  return (
    <View
      style={[
        plain ? styles.plain : styles.card,
        plain ? undefined : { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
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
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.btnText, { color: colors.onPrimary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
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
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  btn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  btnText: { fontSize: 14, fontWeight: '700' },
});
