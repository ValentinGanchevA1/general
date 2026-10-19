import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export interface AppChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** Filter / interest chip with selected state (not color-only — weight + border). */
export function AppChip({
  label,
  selected = false,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: AppChipProps): React.JSX.Element {
  const { colors, radius, fontSize, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: selected ? colors.primaryMutedBg : colors.surfaceRaised,
          borderColor: selected ? colors.primaryBorder : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? colors.primary : colors.textSecondary,
          fontSize: fontSize.sm,
          fontWeight: selected ? '700' : '500',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
