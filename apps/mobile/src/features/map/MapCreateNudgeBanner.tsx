import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

interface Props {
  onCreate: () => void;
  onDismiss: () => void;
}

/**
 * One-shot bottom banner encouraging first create on an empty map.
 * Positioned above the events rail / home indicator.
 */
export function MapCreateNudgeBanner({
  onCreate,
  onDismiss,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.md) + 72 }]}
      pointerEvents="box-none"
    >
      <View style={styles.card} accessibilityRole="summary">
        <Icon name="map-marker-plus-outline" size={22} color={colors.primary} />
        <View style={styles.body}>
          <Text style={styles.title}>Be the first nearby</Text>
          <Text style={styles.subtitle}>Post a listing, event, or alert here.</Text>
        </View>
        <TouchableOpacity
          style={styles.cta}
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="Create something here"
        >
          <Text style={styles.ctaText}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={10}
          style={styles.close}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss create suggestion"
        >
          <Icon name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 25,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1 },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  ctaText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  close: { padding: 8 },
});
