import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { VerificationLevel } from '@g88/shared';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export type TrustChip = { label: string; strong?: boolean };

export type ProfileTrustBlockProps = {
  verification: VerificationLevel;
  idVerified: boolean;
  /** @deprecated Retained for compatibility only; public numeric trust is never rendered. */
  verificationScore?: number | null;
  onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void;
};

export function buildTrustEarnedChips(
  verification: VerificationLevel,
  idVerified: boolean,
): TrustChip[] {
  const order: Array<{ ok: boolean; label: string; strong?: boolean }> = [
    { ok: verification !== 'none', label: 'Email' },
    {
      ok:
        verification === 'phone' ||
        verification === 'selfie' ||
        verification === 'id',
      label: 'Phone',
    },
    {
      ok: verification === 'selfie' || verification === 'id',
      label: 'Photo',
    },
    { ok: idVerified === true, label: 'ID verified', strong: true },
  ];
  return order
    .filter((item) => item.ok)
    .map((item) => ({ label: item.label, ...(item.strong ? { strong: true } : {}) }));
}

/** Visitor-safe trust summary: explicit verified signals, never a numeric score. */
export function ProfileTrustBlock({
  verification,
  idVerified,
  onLayout,
}: ProfileTrustBlockProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const chips = useMemo(
    () => buildTrustEarnedChips(verification, idVerified),
    [verification, idVerified],
  );

  return (
    <View style={styles.trustBlock} onLayout={onLayout}>
      <View style={styles.trustHeader}>
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Identity</Text>
        {idVerified ? (
          <View style={styles.verifiedLabel}>
            <Icon name="shield-check" size={14} color={colors.verified} />
            <Text style={[styles.verifiedText, { color: colors.verified }]}>Verified</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.trustBadges}>
        {chips.length === 0 ? (
          <Text style={[styles.trustEmpty, { color: colors.textTertiary }]}>No verified identity signals yet</Text>
        ) : (
          chips.map((chip) => (
            <View
              key={chip.label}
              style={[
                styles.trustChip,
                {
                  backgroundColor: chip.strong ? colors.discoverySoft : colors.surfacePrimary,
                  borderColor: chip.strong ? colors.discoveryBorder : colors.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.trustChipText,
                  { color: chip.strong ? colors.verified : colors.textSecondary },
                ]}
              >
                {chip.label}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trustBlock: { gap: spacing.sm },
  trustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  verifiedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trustEmpty: { fontSize: 12 },
  trustChip: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustChipText: { fontSize: 12, fontWeight: '600' },
});
