import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme';

interface Props {
  onRetry: () => void;
}

/**
 * Shown when location permission is denied — map-first app must not soft-fail
 * into an empty map with no recovery path (UX-11).
 */
export function LocationPermissionBanner({ onRetry }: Props): React.JSX.Element {
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.copy}>
        <Text style={styles.title}>Location is off</Text>
        <Text style={styles.body}>
          Enable location to see people and places nearby.
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondary}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try location permission again"
        >
          <Text style={styles.secondaryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => {
            void Linking.openSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel="Open system settings"
        >
          <Text style={styles.primaryText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    zIndex: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    gap: spacing.sm,
  },
  copy: { gap: 4 },
  title: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  secondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  secondaryText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm },
  primary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
});
