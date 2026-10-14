import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

export interface BadgeCounterProps {
  count: number;
  /** Cap display (e.g. 99 → 99+). Default 99. */
  max?: number;
  style?: StyleProp<ViewStyle>;
  /** Accessible name, e.g. "unread messages". */
  accessibilityLabel?: string;
}

/** Unread / count pill — not color-only (includes numeric text). */
export function BadgeCounter({
  count,
  max = 99,
  style,
  accessibilityLabel,
}: BadgeCounterProps): React.JSX.Element | null {
  const { colors, fontSize } = useAppTheme();
  if (count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.danger, minWidth: 18, minHeight: 18 },
        style,
      ]}
      accessibilityLabel={accessibilityLabel ?? `${count} unread`}
    >
      <Text style={{ color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
