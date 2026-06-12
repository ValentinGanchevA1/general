// apps/mobile/src/screens/ListingDetailScreen.tsx
//
// P3.7 listing detail. Buyer: favorite, make/withdraw an offer, wave the seller.
// Seller: review offers (accept/decline) and mark the listing sold/withdrawn.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ApiError, ListingOffer, WaveRequest, WaveResponse } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppSelector } from '@/hooks/redux';
import { postJson } from '@/api/client';
import {
  makeOffer,
  respondToOffer,
  toggleFavorite,
  updateListingStatus,
  useListing,
  withdrawOffer,
} from '@/features/trading/useTrading';
import { formatPrice } from '@/features/trading/formatPrice';

type R = RouteProp<RootStackParamList, 'ListingDetail'>;

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
      <View style={[S.container, S.center]}>
        {loading ? (
          <ActivityIndicator color="#00d4ff" />
        ) : (
          <>
            <Icon name="tag-off-outline" size={48} color="#555" />
            <Text style={S.emptyText}>Listing not found.</Text>
          </>
        )}
      </View>
    );
  }

  const isSeller = listing.sellerId === myId;

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#00d4ff" />}
    >
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Listing</Text>
        <TouchableOpacity onPress={() => void onToggleFav()} disabled={favBusy} hitSlop={8}>
          <Icon
            name={listing.favoritedByMe ? 'heart' : 'heart-outline'}
            size={24}
            color={listing.favoritedByMe ? '#ff6b6b' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {listing.thumbnailUrl ? (
        <Image source={{ uri: listing.thumbnailUrl }} style={S.image} />
      ) : (
        <View style={[S.image, S.imagePlaceholder]}>
          <Icon name="image-off-outline" size={40} color="#444" />
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
          {listing.sellerAvatarUrl ? (
            <Image source={{ uri: listing.sellerAvatarUrl }} style={S.sellerAvatar} />
          ) : (
            <View style={[S.sellerAvatar, S.sellerAvatarPlaceholder]}>
              <Text style={S.sellerInitial}>{listing.sellerDisplayName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <Text style={S.sellerName}>{listing.sellerDisplayName}</Text>
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

// ─── Seller wave ────────────────────────────────────────────────────────────

function SellerWaveButton({ sellerId }: { sellerId: string }): React.JSX.Element {
  const [waving, setWaving] = useState(false);
  const onWave = useCallback(async () => {
    setWaving(true);
    try {
      await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId: sellerId,
        context: 'profile',
      });
      Alert.alert('Wave sent', 'The seller will see your wave.');
    } catch (e) {
      const err = e as ApiError;
      Alert.alert(err.code === 'wave.cooldown' ? 'Already waved' : 'Could not wave', err.message || 'Try again.');
    } finally {
      setWaving(false);
    }
  }, [sellerId]);

  return (
    <TouchableOpacity style={S.waveBtn} onPress={() => void onWave()} disabled={waving}>
      {waving ? <ActivityIndicator size="small" color="#0a0a0f" /> : <Icon name="hand-wave" size={16} color="#0a0a0f" />}
      <Text style={S.waveText}>Wave</Text>
    </TouchableOpacity>
  );
}

// ─── Buyer offer ────────────────────────────────────────────────────────────

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
    // A typed price must be valid — otherwise NaN would be dropped and silently
    // submit an offer at the asking price. Empty = intentional "at asking price".
    let offerCents: number | undefined;
    if (amount.trim()) {
      const parsed = parseFloat(amount);
      if (Number.isNaN(parsed) || parsed < 0) {
        Alert.alert('Invalid price', 'Please enter a valid offer price, or leave it blank to offer at the asking price.');
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
      Alert.alert('Could not send offer', (e as ApiError).message || 'Try again.');
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
    return (
      <View style={S.card}>
        <Text style={S.cardTitle}>Your offer</Text>
        <Text style={S.offerLine}>
          {myOffer.offerCents != null ? formatPrice(myOffer.offerCents, currency) : 'At asking price'}
          {'  ·  '}
          <Text style={S.offerStatus}>{myOffer.status}</Text>
        </Text>
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
        placeholderTextColor="#555"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={[S.input, S.multiline]}
        placeholder="Add a message (optional)"
        placeholderTextColor="#555"
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <TouchableOpacity style={[S.primaryBtn, busy && S.btnDisabled]} disabled={busy} onPress={() => void submit()}>
        {busy ? <ActivityIndicator size="small" color="#0a0a0f" /> : <Text style={S.primaryBtnText}>Send offer</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Seller controls ──────────────────────────────────────────────────────────

function SellerControls({
  listingId, status, offers, currency, onChanged,
}: {
  listingId: string;
  status: string;
  offers: ListingOffer[];
  currency: string;
  onChanged: () => void;
}): React.JSX.Element {
  const respond = useCallback(
    async (offerId: string, decision: 'accepted' | 'declined') => {
      try {
        await respondToOffer(offerId, decision);
        onChanged();
      } catch (e) {
        Alert.alert('Could not respond', (e as ApiError).message || 'Try again.');
      }
    },
    [onChanged],
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
              <Text style={S.offerBuyer}>{o.buyerDisplayName}</Text>
              <Text style={S.offerAmount}>
                {o.offerCents != null ? formatPrice(o.offerCents, currency) : 'At asking price'}
                {'  ·  '}<Text style={S.offerStatus}>{o.status}</Text>
              </Text>
              {o.message ? <Text style={S.offerMsg}>{o.message}</Text> : null}
            </View>
            {o.status === 'pending' && status === 'active' ? (
              <View style={S.offerActions}>
                <TouchableOpacity style={S.acceptBtn} onPress={() => void respond(o.id, 'accepted')}>
                  <Icon name="check" size={18} color="#0a0a0f" />
                </TouchableOpacity>
                <TouchableOpacity style={S.declineBtn} onPress={() => void respond(o.id, 'declined')}>
                  <Icon name="close" size={18} color="#fff" />
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
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 48 },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666', fontSize: 15, marginTop: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 56, paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  image: { width: '100%', height: 260, backgroundColor: '#12121f' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },

  body: { padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  price: { color: '#00d4ff', fontSize: 24, fontWeight: '900', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: '#1a1a2e' },
  categoryText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,159,67,0.15)' },
  statusText: { color: '#ff9f43', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  favCount: { color: '#888', fontSize: 12, marginLeft: 'auto' },

  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#12121f' },
  sellerAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { color: '#00d4ff', fontSize: 16, fontWeight: '700' },
  sellerName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  waveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00d4ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  waveText: { color: '#0a0a0f', fontSize: 13, fontWeight: '700' },

  description: { color: '#bbb', fontSize: 15, lineHeight: 22, marginTop: 16 },

  card: {
    marginTop: 20, padding: 16, borderRadius: 14,
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 14 },
  input: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 15, marginBottom: 10,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: '#00d4ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#0a0a0f', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  secondaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  offerLine: { color: '#ddd', fontSize: 15 },
  offerStatus: { color: '#00d4ff', fontWeight: '700', textTransform: 'capitalize' },

  sellerActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  offerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1f1f33',
  },
  offerBuyer: { color: '#fff', fontSize: 15, fontWeight: '600' },
  offerAmount: { color: '#bbb', fontSize: 13, marginTop: 2 },
  offerMsg: { color: '#888', fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  offerActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00d4ff', alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2a4a', alignItems: 'center', justifyContent: 'center' },
});
