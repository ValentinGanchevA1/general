import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  email: string;
  phone: string | null | undefined;
  emailVerified: boolean;
  phoneVerified: boolean;
}

/**
 * Owner-only contact summary under the profile hero.
 * Display only — phone add/verify lives in Settings → Verification.
 */
export function ProfileContactLine({
  email,
  phone,
  emailVerified,
  phoneVerified,
}: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Icon name="email-outline" size={16} color={colors.textMuted} />
        <Text style={styles.text} numberOfLines={1}>
          {email}
        </Text>
        <Icon
          name={emailVerified ? 'check-circle' : 'circle-outline'}
          size={16}
          color={emailVerified ? colors.success : colors.borderStrong}
        />
      </View>
      <View style={[styles.row, styles.rowLast]}>
        <Icon name="phone-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.text, !phone && styles.muted]} numberOfLines={1}>
          {phone ?? 'No phone added'}
        </Text>
        {phone ? (
          <Icon
            name={phoneVerified ? 'check-circle' : 'circle-outline'}
            size={16}
            color={phoneVerified ? colors.success : colors.borderStrong}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    gap: 8,
  },
  rowLast: { borderBottomWidth: 0 },
  text: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  muted: { color: colors.textMuted },
});
