// apps/mobile/src/screens/MarketplaceScreen.tsx
//
// P3.7 trading hub: a nearby browse grid + a "Sell an item" entry + a saved
// (favorites) toggle. Tapping a card opens ListingDetail.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ListingSummary } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserLocation } from '@/features/location/useUserLocation';
import { useBrowseListings, useFavorites } from '@/features/trading/useTrading';
import { formatPrice } from '@/features/trading/formatPrice';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MarketplaceScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const { coords } = useUserLocation();
  const [tab, setTab] = useState<'browse' | 'saved'>('browse');

  const browse = useBrowseListings(tab === 'browse' ? coords : null);
  const saved = useFavorites();

  const data = tab === 'browse' ? browse.listings : saved.favorites;
  const loading = tab === 'browse' ? browse.loading : saved.loading;
  const refresh = tab === 'browse' ? browse.refresh : saved.refresh;

  const renderItem = useCallback(
    ({ item }: { item: ListingSummary }) => (
      <ListingCard item={item} onPress={() => nav.navigate('ListingDetail', { listingId: item.id })} />
    ),
    [nav],
  );

  return (
    <View style={S.container}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Marketplace</Text>
        <TouchableOpacity onPress={() => nav.navigate('ListingCreate')} hitSlop={8}>
          <Icon name="plus-circle" size={24} color="#00d4ff" />
        </TouchableOpacity>
      </View>

      <View style={S.tabs}>
        {(['browse', 'saved'] as const).map((t) => (
          <TouchableOpacity key={t} style={[S.tab, tab === t && S.tabActive]} onPress={() => setTab(t)}>
            <Text style={[S.tabText, tab === t && S.tabTextActive]}>
              {t === 'browse' ? 'Nearby' : 'Saved'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={S.row}
        contentContainerStyle={S.grid}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#00d4ff" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color="#00d4ff" />
          ) : (
            <View style={S.empty}>
              <Icon name={tab === 'browse' ? 'storefront-outline' : 'heart-outline'} size={44} color="#555" />
              <Text style={S.emptyText}>
                {tab === 'browse' ? 'No listings nearby yet.' : "You haven't saved any listings."}
              </Text>
              {tab === 'browse' ? (
                <TouchableOpacity style={S.sellBtn} onPress={() => nav.navigate('ListingCreate')}>
                  <Text style={S.sellBtnText}>Sell an item</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
      />
    </View>
  );
}

function ListingCard({
  item, onPress,
}: {
  item: ListingSummary;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={S.card} activeOpacity={0.85} onPress={onPress}>
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} />
      ) : (
        <View style={[S.thumb, S.thumbPlaceholder]}>
          <Icon name="image-off-outline" size={28} color="#444" />
        </View>
      )}
      {item.status !== 'active' ? (
        <View style={S.statusPill}><Text style={S.statusText}>{item.status}</Text></View>
      ) : null}
      {item.favoritedByMe ? (
        <Icon name="heart" size={18} color="#ff6b6b" style={S.heart} />
      ) : null}
      <Text style={S.cardTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={S.cardPrice}>{formatPrice(item.priceCents, item.currency)}</Text>
      <Text style={S.cardCategory} numberOfLines={1}>{item.category}</Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 56, paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33' },
  tabActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  tabText: { color: '#aaa', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#0a0a0f' },
  grid: { padding: 12, paddingBottom: 40 },
  row: { gap: 12 },
  card: {
    flex: 1, marginBottom: 12, padding: 8, borderRadius: 14,
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
  },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#1a1a2e', marginBottom: 8 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    position: 'absolute', top: 14, left: 14, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  statusText: { color: '#ff9f43', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  heart: { position: 'absolute', top: 14, right: 14 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardPrice: { color: '#00d4ff', fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardCategory: { color: '#888', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 64, paddingHorizontal: 32, gap: 12 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },
  sellBtn: { backgroundColor: '#00d4ff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  sellBtnText: { color: '#0a0a0f', fontSize: 14, fontWeight: '700' },
});
