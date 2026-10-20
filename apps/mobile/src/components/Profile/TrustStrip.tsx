import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export interface TrustChip {
  id: string;
  label: string;
  status: 'success' | 'pending' | 'missing' | 'error';
}

interface TrustStripProps {
  chips: TrustChip[];
  onChipPress?: (chipId: string) => void;
}

export function TrustStrip({ chips, onChipPress }: TrustStripProps): React.JSX.Element {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => {
        const tone =
          chip.status === 'success'
            ? colors.verified
            : chip.status === 'pending'
              ? colors.warning
              : chip.status === 'error'
                ? colors.danger
                : colors.textTertiary;
        const background =
          chip.status === 'success'
            ? colors.discoverySoft
            : chip.status === 'pending'
              ? colors.surfaceSecondary
              : chip.status === 'error'
                ? colors.dangerSurface
                : colors.surfaceSecondary;

        return (
          <Pressable
            key={chip.id}
            onPress={() => onChipPress?.(chip.id)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: background, borderColor: tone },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
          >
            <Text style={[styles.chipText, { color: tone }]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  pressed: { opacity: 0.78 },
});
