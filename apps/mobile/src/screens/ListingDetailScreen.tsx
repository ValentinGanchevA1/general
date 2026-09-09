// apps/mobile/src/screens/ListingDetailScreen.tsx
//
// P3.7 listing detail. Buyer: favorite, make/withdraw an offer, wave the seller.
// Seller: review offers (accept/decline/counter) and mark the listing sold/withdrawn.

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

import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { colors } from '@/theme';

import type { ApiError, ListingOffer, WaveRequest, WaveResponse } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useAppSelector } from '@/hooks/redux';
import { postJson } from '@/api/client';
import {
  counterOffer,
  makeOffer,
  respondToOffer,
  toggleFavorite,
  updateListingStatus,
  useListing,
  withdrawOffer,
} from '@/features/trading/useTrading';
import { formatPrice } from '@/features/trading/formatPrice';
import { openRootScreen, openViaRef } from '@/navigation/openRootScreen';

type R = RouteProp<CommerceStackParamList, 'ListingDetail'>;

export function ListingDetailScreen(): React.JSX.Element {
  const route = useRoute<R>();
  const navigation = useNavigation();
  const { listingId } = route.params;
  const myId = useAppSelector((s) => s.auth.user?.id);

  const { listing, offers, loading, refresh, refreshOffers } = useListing(listingId);
  const [favBusy, setFavBusy] = useState(false);

  const onToggleFav = useCallback(async () => {
    setFavBusy(true);
    try {
      await toggleFavorite(listingId);
      refresh();
    } catch {
      /* refresh keeps state truthful */
    } finally {
      setFavBusy(false);
    }
  }, [listingId, refresh]);

  if (!listing) {
    return (
      <View style={S.container}>
        <ScreenHeader title="Listing" />
        <View style={[S.container, S.center]}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <EmptyState
              variant="plain"
              icon="tag-off-outline"
              title="Listing not found"
              body="This listing may have been removed or the link is invalid."
            />
          )}
        </View>
      </View>
    );
  }

  const isSeller = listing.sellerId === myId;

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <ScreenHeader
        title="Listing"
        right={
          <TouchableOpacity
            onPress={() => void onToggleFav()}
            disabled={favBusy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={listing.favoritedByMe ? 'Remove from saved' : 'Save listing'}
          >
            <Icon
              name={listing.favoritedByMe ? 'heart' : 'heart-outline'}
              size={24}
              color={listing.favoritedByMe ? colors.danger : colors.textPrimary}
            />
          </TouchableOpacity>
        }
      />

      {listing.thumbnailUrl ? (
        <Image source={{ uri: listing.thumbnailUrl }} style={S.image} />
      ) : (
        <View style={[S.image, S.imagePlaceholder]}>
          <Icon name="image-off-outline" size={40} color={colors.borderStrong} />
        </View>
      )}

      <View style={S.body}>
        <Text style={S.title}>{listing.title}</Text>
        <Text style={S.price}>{formatPrice(listing.priceCents, listing.currency)}</Text>
        <View style={S.metaRow}>
          <View style={S.categoryPill}><Text style={S.categoryText}>{listing.category}</Text></View>
          {listing.status !== 'active' ? (
            <View style={S.statusPill}><Text style={S.statusText}>{listing.status}</Text></View>
          ) : null}
          <Text style={S.favCount}>{listing.favoriteCount} saved</Text>
        </View>

        <View style={S.sellerRow}>
          <TouchableOpacity
            style={S.sellerIdentity}
            activeOpacity={0.7}
            onPress={() => openRootScreen(navigation, 'UserProfile', { userId: listing.sellerId })}
          >
            {listing.sellerAvatarUrl ? (
              <Image source={{ uri: listing.sellerAvatarUrl }} style={S.sellerAvatar} />
            ) : (
              <View style={[S.sellerAvatar, S.sellerAvatarPlaceholder]}>
                <Text style={S.sellerInitial}>{listing.sellerDisplayName[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <Text style={S.sellerName}>{listing.sellerDisplayName}</Text>
          </TouchableOpacity>
          {!isSeller ? <SellerWaveButton sellerId={listing.sellerId} /> : null}
        </View>

        {listing.description ? <Text style={S.description}>{listing.description}</Text> : null}

        {isSeller ? (
          <SellerControls
            listingId={listingId}
            status={listing.status}
            offers={offers}
            currency={listing.currency}
            onChanged={() => { refresh(); refreshOffers(); }}
          />
        ) : (
          <BuyerOffer
            listingId={listingId}
            disabled={listing.status !== 'active'}
            myOffer={listing.myOffer}
            askingCents={listing.priceCents}
            currency={listing.currency}
            onChanged={refresh}
          />
        )}
      </View>
    </ScrollView>
  );
}

function SellerWaveButton({ sellerId }: { sellerId: string }): React.JSX.Element {
  const [waving, setWaving] = useState(false);
  const onWave = useCallback(async () => {
    setWaving(true);
    try {
      await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId: sellerId,
        context: 'profile',
      });
      appAlert('Wave sent', 'The seller will see your wave.');
    } catch (e) {
      const err = e as ApiError;
      appAlert(err.code === 'wave.cooldown' ? 'Already waved' : 'Could not wave', err.message || 'Try again.');
    } finally {
      setWaving(false);
    }
  }, [sellerId]);

  return (
    <TouchableOpacity style={S.waveBtn} onPress={() => void onWave()} disabled={waving}>
      {waving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Icon name="hand-wave" size={16} color={colors.onPrimary} />}
      <Text style={S.waveText}>Wave</Text>
    </TouchableOpacity>
  );
}

function BuyerOffer({
  listingId, disabled, myOffer, askingCents, currency, onChanged,
}: {
  listingId: string;
  disabled: boolean;
  myOffer: ListingOffer | null;
  askingCents: number;
  currency: string;
  onChanged: () => void;
}): React.JSX.Element {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    let offerCents: number | undefined;
    if (amount.trim()) {
      const parsed = parseFloat(amount);
      if (Number.isNaN(parsed) || parsed < 0) {
        appAlert('Invalid price', 'Please enter a valid offer price, or leave it blank to offer at the asking price.');
        return;
      }
      offerCents = Math.round(parsed * 100);
    }
    setBusy(true);
    try {
      await makeOffer(listingId, {
        ...(offerCents != null ? { offerCents } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setAmount(''); setMessage('');
      onChanged();
    } catch (e) {
      appAlert('Could not send offer', (e as ApiError).message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [amount, message, listingId, onChanged]);

  const onWithdraw = useCallback(async () => {
    setBusy(true);
    try {
      await withdrawOffer(listingId);
      onChanged();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }, [listingId, onChanged]);

  if (myOffer && myOffer.status !== 'withdrawn') {
    const sellerCountered = myOffer.lastActor === 'seller' && myOffer.status === 'pending';
    return (
      <View style={S.card}>
        <Text style={S.cardTitle}>{sellerCountered ? 'Seller counter-offer' : 'Your offer'}</Text>
        <Text style={S.offerLine}>
          {myOffer.offerCents != null ? formatPrice(myOffer.offerCents, currency) : 'At asking price'}
          {'  ·  '}
          <Text style={S.offerStatus}>{myOffer.status}</Text>
        </Text>
        {sellerCountered ? (
          <Text style={S.counterHint}>
            The seller proposed a new price. Accept by offering that amount, re-counter, or withdraw.
          </Text>
        ) : null}
        {myOffer.status === 'pending' ? (
          <TouchableOpacity style={S.secondaryBtn} disabled={busy} onPress={() => void onWithdraw()}>
            <Text style={S.secondaryBtnText}>Withdraw offer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (disabled) {
    return (
      <View style={S.card}>
        <Text style={S.emptyHint}>This listing is no longer accepting offers.</Text>
      </View>
    );
  }

  return (
    <View style={S.card}>
      <Text style={S.cardTitle}>Make an offer</Text>
      <TextInput
        style={S.input}
        placeholder={`Your price (asking ${formatPrice(askingCents, currency)})`}
        placeholderTextColor={colors.textFaint}
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={[S.input, S.multiline]}
        placeholder="Add a message (optional)"
        placeholderTextColor={colors.textFaint}
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <TouchableOpacity style={[S.primaryBtn, busy && S.btnDisabled]} disabled={busy} onPress={() => void submit()}>
        {busy ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={S.primaryBtnText}>Send offer</Text>}
      </TouchableOpacity>
    </View>
  );
}

function SellerControls({
  listingId, status, offers, currency, onChanged,
}: {
  listingId: string;
  status: string;
  offers: ListingOffer[];
  currency: string;
  onChanged: () => void;
}): React.JSX.Element {
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterBusy, setCounterBusy] = useState(false);

  const respond = useCallback(
    async (offerId: string, decision: 'accepted' | 'declined') => {
      try {
        await respondToOffer(offerId, decision);
        onChanged();
      } catch (e) {
        appAlert('Could not respond', (e as ApiError).message || 'Try again.');
      }
    },
    [onChanged],
  );

  const onCounter = useCallback(
    async (offerId: string) => {
      const parsed = parseFloat(counterAmount);
      if (Number.isNaN(parsed) || parsed < 0) {
        appAlert('Invalid price', 'Enter a valid counter-offer amount.');
        return;
      }
      setCounterBusy(true);
      try {
        await counterOffer(offerId, { offerCents: Math.round(parsed * 100) });
        setCounterFor(null);
        setCounterAmount('');
        onChanged();
      } catch (e) {
        appAlert('Could not counter', (e as ApiError).message || 'Try again.');
      } finally {
        setCounterBusy(false);
      }
    },
    [counterAmount, onChanged],
  );

  const setStatus = useCallback(
    async (next: 'active' | 'sold' | 'withdrawn') => {
      try {
        await updateListingStatus(listingId, next);
        onChanged();
      } catch {
        /* noop */
      }
    },
    [listingId, onChanged],
  );

  return (
    <View>
      <View style={S.sellerActions}>
        {status === 'active' ? (
          <>
            <TouchableOpacity style={S.secondaryBtn} onPress={() => void setStatus('sold')}>
              <Text style={S.secondaryBtnText}>Mark sold</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.secondaryBtn} onPress={() => void setStatus('withdrawn')}>
              <Text style={S.secondaryBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={S.secondaryBtn} onPress={() => void setStatus('active')}>
            <Text style={S.secondaryBtnText}>Relist</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={S.cardTitle}>Offers ({offers.length})</Text>
      {offers.length === 0 ? (
        <Text style={S.emptyHint}>No offers yet.</Text>
      ) : (
        offers.map((o) => (
          <View key={o.id} style={S.offerRow}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => openViaRef('UserProfile', { userId: o.buyerId })}
                hitSlop={4}
              >
                <Text style={S.offerBuyer}>{o.buyerDisplayName}</Text>
              </TouchableOpacity>
              <Text style={S.offerAmount}>
                {o.offerCents != null ? formatPrice(o.offerCents, currency) : 'At asking price'}
                {'  ·  '}<Text style={S.offerStatus}>{o.status}</Text>
                {o.lastActor === 'seller' && o.status === 'pending' ? (
                  <Text style={S.counterBadge}> · your counter</Text>
                ) : null}
              </Text>
              {o.message ? <Text style={S.offerMsg}>{o.message}</Text> : null}
              {counterFor === o.id ? (
                <View style={S.counterBox}>
                  <TextInput
                    style={S.input}
                    placeholder="Counter price"
                    placeholderTextColor={colors.textFaint}
                    value={counterAmount}
                    onChangeText={(t) => setCounterAmount(t.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <View style={S.counterActions}>
                    <TouchableOpacity
                      style={[S.primaryBtn, { flex: 1 }, counterBusy && S.btnDisabled]}
                      disabled={counterBusy}
                      onPress={() => void onCounter(o.id)}
                    >
                      {counterBusy ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                      ) : (
                        <Text style={S.primaryBtnText}>Send counter</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={S.secondaryBtn}
                      onPress={() => { setCounterFor(null); setCounterAmount(''); }}
                    >
                      <Text style={S.secondaryBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
            {o.status === 'pending' && status === 'active' && counterFor !== o.id ? (
              <View style={S.offerActions}>
                <TouchableOpacity
                  style={S.counterBtn}
                  onPress={() => {
                    setCounterFor(o.id);
                    setCounterAmount(o.offerCents != null ? String(o.offerCents / 100) : '');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Counter offer"
                >
                  <Icon name="swap-horizontal" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={S.acceptBtn} onPress={() => void respond(o.id, 'accepted')}>
                  <Icon name="check" size={18} color={colors.onPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={S.declineBtn} onPress={() => void respond(o.id, 'declined')}>
                  <Icon name="close" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  center: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 260, backgroundColor: colors.surface },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  price: { color: colors.primary, fontSize: 24, fontWeight: '900', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  categoryText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,159,67,0.15)' },
  statusText: { color: colors.warning, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  favCount: { color: colors.textMuted, fontSize: 12, marginLeft: 'auto' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  sellerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
  sellerAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  sellerName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 },
  waveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  waveText: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 16 },
  card: {
    marginTop: 20, padding: 16, borderRadius: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  emptyHint: { color: colors.textFaint, fontSize: 14 },
  counterHint: { color: colors.textMuted, fontSize: 13, marginTop: 8, marginBottom: 8, lineHeight: 18 },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 15, marginBottom: 10,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  secondaryBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  offerLine: { color: colors.textSecondary, fontSize: 15 },
  offerStatus: { color: colors.primary, fontWeight: '700', textTransform: 'capitalize' },
  counterBadge: { color: colors.warning, fontWeight: '600' },
  sellerActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  offerRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  offerBuyer: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  offerAmount: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  offerMsg: { color: colors.textMuted, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  offerActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  counterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  counterBox: { marginTop: 10 },
  counterActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
