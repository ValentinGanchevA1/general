import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

export interface StatItemProps {
  value: string | number;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function StatItem({ value, label, style }: StatItemProps): React.JSX.Element {
  const { colors, fontSize, spacing } = useAppTheme();

  return (
    <View style={[styles.item, style]} accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' }}>
        {value}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          marginTop: spacing.xs,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    minWidth: 56,
  },
});
