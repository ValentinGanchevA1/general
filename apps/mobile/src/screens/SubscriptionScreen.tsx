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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

const TIER_RANK: Record<string, number> = { free: 0, basic: 1, premium: 2, vip: 3 };

export function SubscriptionScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const currentTier = profile?.subscriptionTier ?? 'free';
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tier may have changed via the Stripe webhook while the user was in the
  // browser — refetch whenever the screen regains focus.
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
        <View style={styles.back} />
      </View>

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
                onPress={() => upgrade(plan.tier as PaidTier)}
                disabled={busyTier !== null}
              >
                {busyTier === plan.tier ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.ctaText}>Upgrade to {plan.name}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      {currentTier !== 'free' ? (
        <TouchableOpacity style={styles.manageBtn} onPress={manage} disabled={busyTier !== null}>
          {busyTier === 'manage' ? (
            <ActivityIndicator color="#00d4ff" />
          ) : (
            <Text style={styles.manageText}>Manage subscription</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <Text style={styles.fine}>Billing is handled securely by Stripe. Cancel anytime.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  intro: { color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginBottom: 16 },
  error: { color: '#ff4444', fontSize: 13, textAlign: 'center', marginBottom: 12, paddingHorizontal: 24 },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    backgroundColor: '#12121f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 10,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  price: { fontSize: 16, fontWeight: '700' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: '#ccc', fontSize: 14 },
  currentPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a24',
    borderRadius: 16,
  },
  currentText: { color: '#888', fontSize: 12, fontWeight: '600' },
  cta: { marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#000', fontWeight: '700', fontSize: 15 },
  manageBtn: { marginHorizontal: 20, marginTop: 4, padding: 14, alignItems: 'center' },
  manageText: { color: '#00d4ff', fontWeight: '600', fontSize: 15 },
  fine: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
});
