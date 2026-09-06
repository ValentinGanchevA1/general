// Map chrome: All | For sale | Wanted — filters discovery listingMode only.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ListingMode } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

export type ListingModeFilterValue = 'all' | ListingMode;

interface Props {
  value: ListingModeFilterValue;
  onChange: (next: ListingModeFilterValue) => void;
  /** Absolute top from safe-area stack. */
  top: number;
}

const OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sell', label: 'For sale' },
  { id: 'buy', label: 'Wanted' },
];

export function ListingModeFilter({
  value,
  onChange,
  top,
}: Props): React.JSX.Element {
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${opt.label} listings`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg + 56,
    zIndex: 18,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,18,31,0.92)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
});
