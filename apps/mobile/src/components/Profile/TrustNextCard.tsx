import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserProfile } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

import {
  buildVerificationItems,
  type VerificationItem,
  type VerificationItemId,
} from './VerificationStatusSheet';

export interface TrustNextCardProps {
  profile: UserProfile;
  onContinue: (id: VerificationItemId) => void;
  /** Optional: open full verification sheet (badge / list). */
  onOpenDetails?: () => void;
}

function nextActionable(items: VerificationItem[]): VerificationItem | null {
  // Prefer first incomplete that is not pending-only id review without resubmit path.
  for (const item of items) {
    if (item.status === 'success') continue;
    return item;
  }
  return null;
}

const CTA_LABEL: Record<VerificationItemId, string> = {
  email: 'Verify email',
  phone: 'Add phone',
  id: 'Verify ID',
};

/**
 * Self-profile surface: one next trust step, or “Fully verified”.
 * Full checklist remains on VerificationStatusSheet (badge).
 */
export function TrustNextCard({
  profile,
  onContinue,
  onOpenDetails,
}: TrustNextCardProps): React.JSX.Element {
  const items = useMemo(() => buildVerificationItems(profile), [profile]);
  const next = useMemo(() => nextActionable(items), [items]);
  const score = profile.verificationScore ?? 0;

  const doneChips = items
    .filter((i) => i.status === 'success')
    .map((i) => (i.id === 'email' ? 'Email ✓' : i.id === 'phone' ? 'Phone ✓' : 'ID ✓'));

  if (!next) {
    return (
      <View style={styles.wrap} accessibilityRole="summary">
        <View style={[styles.card, styles.cardDone]}>
          <Icon name="shield-check" size={22} color={colors.success} />
          <View style={styles.body}>
            <Text style={styles.kicker}>Trust</Text>
            <Text style={styles.title}>Fully verified</Text>
            <Text style={styles.subtitle}>
              {score}% · {doneChips.join(' · ') || 'All steps complete'}
            </Text>
          </View>
          {onOpenDetails ? (
            <Pressable
              onPress={onOpenDetails}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open verification details"
            >
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const isPendingId = next.id === 'id' && next.status === 'pending';
  const accent =
    next.status === 'pending'
      ? colors.warning
      : next.status === 'error'
        ? colors.danger
        : colors.primary;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.card}>
        <Icon
          name={
            next.status === 'pending'
              ? 'clock-outline'
              : next.status === 'error'
                ? 'alert-circle'
                : 'shield-outline'
          }
          size={22}
          color={accent}
        />
        <View style={styles.body}>
          <Text style={styles.kicker}>Trust</Text>
          <Text style={styles.title}>
            {isPendingId ? 'ID under review' : `Next: ${next.title}`}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {doneChips.length > 0 ? `${doneChips.join(' · ')} · ` : ''}
            {next.detail}
          </Text>
        </View>
        {isPendingId ? (
          onOpenDetails ? (
            <Pressable
              onPress={onOpenDetails}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open verification details"
            >
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null
        ) : (
          <Pressable
            style={[styles.cta, { backgroundColor: accent }]}
            onPress={() => onContinue(next.id)}
            accessibilityRole="button"
            accessibilityLabel={CTA_LABEL[next.id]}
          >
            <Text style={styles.ctaText}>
              {next.status === 'error' && next.id === 'id' ? 'Resubmit' : 'Continue'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardDone: {
    borderColor: 'rgba(76, 175, 80, 0.35)',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  ctaText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
