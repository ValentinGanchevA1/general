import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';
import { nexusVisual } from '@/theme/nexusVisual';

export interface AppChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function AppChip({ label, selected = false, onPress, style, accessibilityLabel, testID }: AppChipProps): React.JSX.Element {
  const { colors, radius, fontSize, spacing, mode, shadow } = useAppTheme();
  const isNexus = mode === 'protos-nexus';

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
          borderRadius: isNexus ? nexusVisual.radius.pill : radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: selected ? colors.primaryMutedBg : colors.surfaceRaised,
          borderColor: selected ? colors.primaryBorder : colors.border,
          borderWidth: isNexus ? nexusVisual.borderWidth : 1,
          opacity: pressed ? 0.85 : 1,
        },
        isNexus && selected ? shadow(0.14) : null,
        style,
      ]}
    >
      <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: fontSize.sm, fontWeight: selected ? '700' : '500' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start' },
});
