import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius, fontSize } from '@/theme';

export interface TrustChip {
  id: string;
  label: string;
  status: 'success' | 'pending' | 'missing' | 'error';
}

interface TrustStripProps {
  chips: TrustChip[];
  onChipPress?: (chipId: string) => void;
}

const statusStyles = {
  success: { bg: 'rgba(76, 175, 80, 0.15)', text: colors.success },
  pending: { bg: 'rgba(255, 157, 60, 0.15)', text: colors.warning },
  error: { bg: 'rgba(255, 68, 68, 0.15)', text: colors.danger },
  missing: { bg: 'rgba(85, 85, 85, 0.35)', text: colors.textMuted },
};

export function TrustStrip({
  chips,
  onChipPress,
}: TrustStripProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => {
        const s = statusStyles[chip.status];
        return (
          <Pressable
            key={chip.id}
            onPress={() => onChipPress?.(chip.id)}
            style={[styles.chip, { backgroundColor: s.bg }]}
          >
            <Text style={[styles.chipText, { color: s.text }]}>{chip.label}</Text>
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
