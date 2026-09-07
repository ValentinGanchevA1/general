import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  CheckoutSessionResponse,
  CreateCheckoutRequest,
  PaidTier,
  PortalSessionResponse,
} from '@g88/shared';
import { SUBSCRIPTION_PLANS } from '@g88/shared';

import { postJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { TIER_COLOR } from '@/features/profile/socialConfig';
import { extractMessage } from '@/utils/extractMessage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing, radius } from '@/theme';

const TIER_RANK: Record<string, number> = { free: 0, basic: 1, premium: 2 };

export function SubscriptionScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const currentTier = profile?.subscriptionTier ?? 'free';
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchProfile());
    }, [dispatch]),
  );

  const openExternal = async (url: string): Promise<void> => {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else setError('Could not open the billing page.');
  };

  const upgrade = async (tier: PaidTier): Promise<void> => {
    setBusyTier(tier);
    setError(null);
    try {
      const res = await postJson<CreateCheckoutRequest, CheckoutSessionResponse>(
        '/subscriptions/checkout',
        { tier },
      );
      await openExternal(res.url);
    } catch (e) {
      setError(extractMessage(e, 'Checkout is unavailable right now.'));
    } finally {
      setBusyTier(null);
    }
  };

  const manage = async (): Promise<void> => {
    setBusyTier('manage');
    setError(null);
    try {
      const res = await postJson<undefined, PortalSessionResponse>('/subscriptions/portal', undefined);
      await openExternal(res.url);
    } catch (e) {
      setError(extractMessage(e, 'Could not open billing management.'));
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Premium" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Upgrade to unlock more reach and visibility.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isUpgrade = TIER_RANK[plan.tier]! > TIER_RANK[currentTier]!;
          const color = TIER_COLOR[plan.tier];
          return (
            <View key={plan.tier} style={[styles.card, isCurrent && { borderColor: color }]}>
              <View style={styles.cardHead}>
                <View style={styles.cardTitleRow}>
                  {plan.tier !== 'free' ? <Icon name="crown" size={18} color={color} /> : null}
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>
                <Text style={[styles.price, { color }]}>{plan.priceLabel}</Text>
              </View>

              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Icon name="check" size={16} color={color} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}

              {isCurrent ? (
                <View style={styles.currentPill}>
                  <Text style={styles.currentText}>Current plan</Text>
                </View>
              ) : isUpgrade ? (
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: color }]}
                  onPress={() => void upgrade(plan.tier as PaidTier)}
                  disabled={busyTier !== null}
                >
                  {busyTier === plan.tier ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.ctaText}>Upgrade to {plan.name}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        {currentTier !== 'free' ? (
          <TouchableOpacity style={styles.manageBtn} onPress={() => void manage()} disabled={busyTier !== null}>
            {busyTier === 'manage' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.manageText}>Manage subscription</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <Text style={styles.fine}>Billing is handled securely by Stripe. Cancel anytime.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  intro: {
    color: colors.textMuted,
    fontSize: fontSize.md - 1,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 24,
  },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planName: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  price: { fontSize: fontSize.md + 1, fontWeight: '700' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { color: colors.textSecondary, fontSize: fontSize.md - 1 },
  currentPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
  },
  currentText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  cta: { marginTop: spacing.sm, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  manageBtn: { marginHorizontal: spacing.xl, marginTop: 4, padding: 14, alignItems: 'center' },
  manageText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.md },
  fine: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: 32,
  },
});
