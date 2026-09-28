import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { UserPrimaryCta } from '@/features/social/resolveUserPrimaryCta';
import { colors, radius, spacing } from '@/theme';

export type ProfilePrimaryCtaRowProps = {
  primaryCta: UserPrimaryCta;
  onPress: () => void;
  waving?: boolean;
  messaging?: boolean;
};

/**
 * Single primary CTA under hero (Wave or Message).
 * null when kind is loading / none.
 */
export function ProfilePrimaryCtaRow({
  primaryCta,
  onPress,
  waving = false,
  messaging = false,
}: ProfilePrimaryCtaRowProps): React.JSX.Element | null {
  if (primaryCta.kind === 'message') {
    return (
      <View style={styles.primaryCtaRow}>
        <TouchableOpacity
          style={[styles.primaryCta, styles.messagePrimaryFill, messaging && styles.btnDisabled]}
          onPress={onPress}
          disabled={messaging}
          accessibilityRole="button"
          accessibilityLabel="Message"
        >
          {messaging ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryCtaText}>{primaryCta.label}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (primaryCta.kind === 'wave') {
    return (
      <View style={styles.primaryCtaRow}>
        <TouchableOpacity
          style={[styles.primaryCta, styles.wavePrimary, waving && styles.btnDisabled]}
          onPress={onPress}
          disabled={waving}
          accessibilityRole="button"
          accessibilityLabel="Wave"
        >
          {waving ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryCtaText}>👋 {primaryCta.label}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  primaryCtaRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
    marginBottom: 10,
  },
  primaryCta: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  wavePrimary: {
    backgroundColor: colors.primary,
  },
  messagePrimaryFill: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  primaryCtaText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
});
