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

import { colors, fontSize, radius, spacing } from '@/theme';

export interface ListRowProps {
  title: string;
  subtitle?: string | undefined;
  /** MaterialCommunityIcons name. */
  icon?: string | undefined;
  onPress?: (() => void) | undefined;
  /**
   * Right-side content. Defaults to chevron when `onPress` is set and trailing is omitted.
   * Pass `null` to hide. Pass a node (e.g. Switch) for custom trailing.
   */
  trailing?: React.ReactNode | 'chevron' | null | undefined;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  /**
   * `standalone` (default) — bordered card (Settings rows).
   * `inset` — hairline bottom only; parent supplies grouped card chrome (Profile menu).
   */
  variant?: 'standalone' | 'inset' | undefined;
  /** When variant=inset, drop the bottom hairline (last item). */
  last?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

/**
 * Shared list / settings row: title + optional subtitle + optional icon + trailing.
 * Min height 44 for touch targets.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
  destructive = false,
  disabled = false,
  accessibilityLabel,
  variant = 'standalone',
  last = false,
  style,
}: ListRowProps): React.JSX.Element {
  const resolvedTrailing =
    trailing === undefined
      ? onPress
        ? 'chevron'
        : null
      : trailing;

  const body = (
    <>
      {icon ? (
        <Icon
          name={icon}
          size={20}
          color={destructive ? colors.danger : colors.textMuted}
          style={styles.icon}
        />
      ) : null}
      <View style={styles.content}>
        <Text
          style={[styles.title, destructive ? styles.titleDestructive : undefined]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {resolvedTrailing === 'chevron' ? (
        <Icon name="chevron-right" size={22} color={colors.textFaint} />
      ) : resolvedTrailing != null ? (
        resolvedTrailing
      ) : null}
    </>
  );

  const rowStyle = [
    variant === 'inset' ? styles.inset : styles.standalone,
    variant === 'inset' && last ? styles.insetLast : undefined,
    disabled ? styles.disabled : undefined,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled }}
        activeOpacity={0.7}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={rowStyle}
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  standalone: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    gap: spacing.sm,
  },
  insetLast: {
    borderBottomWidth: 0,
  },
  disabled: {
    opacity: 0.45,
  },
  icon: {
    marginRight: 4,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  titleDestructive: {
    color: colors.danger,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
});
