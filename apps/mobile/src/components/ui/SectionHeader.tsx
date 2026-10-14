import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps): React.JSX.Element {
  const { colors, fontSize, spacing, layout } = useAppTheme();

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: layout.screenPaddingH, marginBottom: spacing.sm },
        style,
      ]}
    >
      <Text
        style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', flex: 1 }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={{ color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
