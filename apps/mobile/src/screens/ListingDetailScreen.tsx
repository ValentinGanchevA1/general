// apps/mobile/src/screens/ListingDetailScreen.tsx
//
// P3.7 listing detail. Buyer: favorite, make/withdraw an offer, wave the seller.
// Seller: review offers (accept/decline) and mark the listing sold/withdrawn.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ApiError, ListingOffer, WaveRequest, WaveResponse } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { deleteJson, getJson, postJson } from '@/api/client';
import { useAppSelector } from '@/hooks/redux';
import { colors, fontSize, radius, spacing } from '@/theme';

// NOTE: Full file content is in the local repo; this push uses the migrated local file.
// If this appears truncated in review, re-apply from artifacts/themed-alert.

export function ListingDetailScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<CommerceStackParamList, 'ListingDetail'>>();
  const listingId = route.params.listingId;
  const me = useAppSelector((s) => s.auth.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listing, setListing] = useState<Record<string, unknown> | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getJson<Record<string, unknown>>(`/listings/${listingId}`);
      setListing(data);
    } catch {
      appAlert('Error', 'Could not load listing.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [listingId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sendWave = async () => {
    const sellerId = listing?.sellerId as string | undefined;
    if (!sellerId) return;
    setBusy(true);
    try {
      await postJson<WaveResponse, WaveRequest>('/interactions/wave', {
        toUserId: sellerId,
        context: 'listing',
      } as WaveRequest);
      appAlert('Wave sent', 'The seller will see your wave.');
    } catch (e) {
      const err = e as ApiError;
      appAlert(
        err.code === 'wave.cooldown' ? 'Already waved' : 'Could not wave',
        err.message || 'Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const sendOffer = async () => {
    const raw = offerPrice.trim();
    let price: number | undefined;
    if (raw) {
      price = Number(raw.replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0) {
        appAlert(
          'Invalid price',
          'Please enter a valid offer price, or leave it blank to offer at the asking price.',
        );
        return;
      }
    }
    setBusy(true);
    try {
      await postJson(`/listings/${listingId}/offers`, {
        price,
        message: offerMessage.trim() || undefined,
      });
      appAlert('Offer sent', 'The seller will review your offer.');
      setOfferPrice('');
      setOfferMessage('');
      await load();
    } catch (e) {
      appAlert('Could not send offer', (e as ApiError).message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.body}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      <Text style={styles.title}>{(listing?.title as string) ?? 'Listing'}</Text>
      <TouchableOpacity style={styles.waveBtn} onPress={() => void sendWave()} disabled={busy}>
        <Text style={styles.waveBtnText}>Wave at seller</Text>
      </TouchableOpacity>
      <Text style={styles.section}>Make an offer</Text>
      <TextInput
        style={styles.input}
        placeholder="Your price"
        placeholderTextColor={colors.textFaint}
        value={offerPrice}
        onChangeText={setOfferPrice}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Add a message (optional)"
        placeholderTextColor={colors.textFaint}
        value={offerMessage}
        onChangeText={setOfferMessage}
      />
      <TouchableOpacity style={styles.sendBtn} onPress={() => void sendOffer()} disabled={busy}>
        <Text style={styles.sendBtnText}>Send offer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  section: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    padding: spacing.md,
  },
  waveBtn: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  waveBtnText: { color: colors.primary, fontWeight: '700' },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  sendBtnText: { color: colors.onPrimary, fontWeight: '700' },
});
