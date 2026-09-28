import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { VerificationLevel } from '@g88/shared';
import {
  formatTrustScoreLabel,
  trustEmptyCopy,
} from '@/features/profile/formatTrustScore';
import { colors, radius, spacing } from '@/theme';

export type TrustChip = { label: string };

export type ProfileTrustBlockProps = {
  verification: VerificationLevel;
  idVerified: boolean;
  verificationScore: number | null | undefined;
  /** Optional layout hook for deep-link scroll. */
  onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void;
};

/** Build earned trust chips from verification ladder (visitor surface). */
export function buildTrustEarnedChips(
  verification: VerificationLevel,
  idVerified: boolean,
): TrustChip[] {
  const order: Array<{ ok: boolean; label: string }> = [
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
    { ok: idVerified === true, label: 'ID' },
  ];
  return order.filter((b) => b.ok).map((b) => ({ label: b.label }));
}

/**
 * Trust score + earned ladder chips (other profile).
 * Self continues to use TrustNextCard until PR-D.
 */
export function ProfileTrustBlock({
  verification,
  idVerified,
  verificationScore,
  onLayout,
}: ProfileTrustBlockProps): React.JSX.Element {
  const chips = useMemo(
    () => buildTrustEarnedChips(verification, idVerified),
    [verification, idVerified],
  );

  return (
    <View style={styles.trustBlock} onLayout={onLayout}>
      <View style={styles.trustHeader}>
        <Text style={styles.sectionLabel}>Trust</Text>
        <Text style={styles.trustScore}>{formatTrustScoreLabel(verificationScore)}</Text>
      </View>
      {chips.length === 0 ? (
        <Text style={styles.trustEmpty}>{trustEmptyCopy()}</Text>
      ) : (
        <View style={styles.trustBadges}>
          {chips.map((b) => (
            <View
              key={b.label}
              style={[styles.trustChip, b.label === 'ID' ? styles.trustChipStrong : undefined]}
            >
              <Text
                style={b.label === 'ID' ? styles.trustChipStrongText : styles.trustChipText}
              >
                {b.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trustBlock: { gap: 6 },
  trustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trustScore: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trustChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  trustChipStrong: { backgroundColor: colors.primary },
  trustChipStrongText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
  trustEmpty: { color: colors.textFaint, fontSize: 12 },
});
