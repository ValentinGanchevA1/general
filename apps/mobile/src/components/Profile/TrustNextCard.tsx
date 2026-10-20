import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserProfile } from '@g88/shared';
import { resolveTrustNextStep } from '@g88/shared';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

import { resolveNexaTrustVisualFromProfile } from './nexaTrustVisuals';
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
  const { colors } = useAppTheme();
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
  const trust = useMemo(() => resolveNexaTrustVisualFromProfile(profile), [profile]);

  if (next.kind === 'done') {
    const needsSupportingProfile = !trust.socialConnected;
    return (
      <View style={styles.wrap} accessibilityRole="summary">
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfacePrimary,
              borderColor: colors.discoveryBorder,
            },
          ]}
        >
          <Icon name="shield-check" size={22} color={colors.verified} />
          <View style={styles.body}>
            <Text style={[styles.kicker, { color: colors.discovery }]}>TRUST</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{trust.label}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {needsSupportingProfile
                ? 'Government ID verified. Add a connected profile as an optional supporting signal.'
                : trust.detail}
            </Text>
          </View>
          {needsSupportingProfile ? (
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.actionPrimary },
                pressed && styles.pressed,
              ]}
              onPress={() => onContinue('social')}
              accessibilityRole="button"
              accessibilityLabel="Connect a supporting profile"
            >
              <Text style={[styles.ctaText, { color: colors.onPrimary }]}>Add</Text>
            </Pressable>
          ) : onOpenDetails ? (
            <Pressable
              onPress={onOpenDetails}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open verification details"
            >
              <Icon name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const isPending = next.kind === 'pending';
  const isResubmit = next.step === 'id' && next.ctaLabel === 'Resubmit';
  const accent = isPending
    ? colors.warning
    : isResubmit
      ? colors.danger
      : colors.actionPrimary;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfacePrimary,
            borderColor: colors.borderDefault,
          },
        ]}
      >
        <Icon
          name={isPending ? 'clock-outline' : isResubmit ? 'alert-circle' : 'shield-outline'}
          size={22}
          color={accent}
        />
        <View style={styles.body}>
          <Text style={[styles.kicker, { color: colors.textTertiary }]}>TRUST</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isPending ? next.title : `Next: ${next.title}`}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
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
              <Icon name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
          ) : null
        ) : next.step ? (
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
            onPress={() => onContinue(next.step!)}
            accessibilityRole="button"
            accessibilityLabel={next.ctaLabel ?? 'Continue'}
          >
            <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
              {next.ctaLabel ?? 'Continue'}
            </Text>
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
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  cta: {
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
