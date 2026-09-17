import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserProfile } from '@g88/shared';
import { resolveTrustNextStep } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

import type { VerificationItemId } from './VerificationStatusSheet';

export interface TrustNextCardProps {
  profile: UserProfile;
  onContinue: (id: VerificationItemId) => void;
  onOpenDetails?: () => void;
}

export function TrustNextCard({
  profile,
  onContinue,
  onOpenDetails,
}: TrustNextCardProps): React.JSX.Element {
  const next = useMemo(
    () =>
      resolveTrustNextStep({
        emailVerified: profile.badges?.email === true,
        phoneVerified: profile.badges?.phone === true,
        ...(profile.idVerificationStatus != null
          ? { idStatus: profile.idVerificationStatus }
          : {}),
      }),
    [profile.badges?.email, profile.badges?.phone, profile.idVerificationStatus],
  );
  const score = profile.verificationScore ?? 0;

  if (next.kind === 'done') {
    return (
      <View style={styles.wrap} accessibilityRole="summary">
        <View style={[styles.card, styles.cardDone]}>
          <Icon name="shield-check" size={22} color={colors.success} />
          <View style={styles.body}>
            <Text style={styles.kicker}>Trust</Text>
            <Text style={styles.title}>{next.title}</Text>
            <Text style={styles.subtitle}>
              {score}% · {next.detail}
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

  const isPending = next.kind === 'pending';
  const accent = isPending
    ? colors.warning
    : next.step === 'id' && next.ctaLabel === 'Resubmit'
      ? colors.danger
      : colors.primary;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.card}>
        <Icon
          name={
            isPending
              ? 'clock-outline'
              : next.ctaLabel === 'Resubmit'
                ? 'alert-circle'
                : 'shield-outline'
          }
          size={22}
          color={accent}
        />
        <View style={styles.body}>
          <Text style={styles.kicker}>Trust</Text>
          <Text style={styles.title}>
            {isPending ? next.title : `Next: ${next.title}`}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {score > 0 ? `${score}% · ` : ''}
            {next.detail}
          </Text>
        </View>
        {isPending ? (
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
        ) : next.step ? (
          <Pressable
            style={[styles.cta, { backgroundColor: accent }]}
            onPress={() => onContinue(next.step!)}
            accessibilityRole="button"
            accessibilityLabel={next.ctaLabel ?? 'Continue'}
          >
            <Text style={styles.ctaText}>{next.ctaLabel ?? 'Continue'}</Text>
          </Pressable>
        ) : null}
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
