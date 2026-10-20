import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { InboxItem } from '@g88/shared';

import { fontSize, spacing, useAppTheme } from '@/theme';

import { useActivityAcknowledgement } from './useActivityAcknowledgement';

export function ActivityAcknowledgementAction({
  items,
}: {
  items: readonly InboxItem[];
}): React.JSX.Element | null {
  const { colors } = useAppTheme();
  const { hasUnseen, acknowledge } = useActivityAcknowledgement(items);

  if (!hasUnseen) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={acknowledge}
        accessibilityRole="button"
        accessibilityLabel="Mark Activity as read"
        hitSlop={8}
      >
        <Text style={[styles.label, { color: colors.primary }]}>Mark as read</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
