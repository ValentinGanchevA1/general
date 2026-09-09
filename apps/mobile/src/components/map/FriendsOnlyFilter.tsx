// Map chrome: Friends toggle — discovery friendsOnly layer.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

interface Props {
  active: boolean;
  onChange: (next: boolean) => void;
  /** Absolute top from safe-area stack (same band as listing mode). */
  top: number;
}

export function FriendsOnlyFilter({
  active,
  onChange,
  top,
}: Props): React.JSX.Element {
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <Pressable
        onPress={() => onChange(!active)}
        style={[styles.chip, active ? styles.chipActive : undefined]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={active ? 'Show everyone nearby' : 'Show friends only'}
      >
        <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>
          Friends
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 18,
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
    backgroundColor: colors.entityFriend,
    borderColor: colors.entityFriend,
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
