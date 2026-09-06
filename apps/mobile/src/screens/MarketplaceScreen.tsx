// apps/mobile/src/screens/MarketplaceScreen.tsx
//
// P3.7 trading hub: nearby browse grid + Sell entry + saved toggle.
// Mode filter (All / For sale / Wanted) — same labels as map.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ListingMode, ListingSummary } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { useBrowseListings, useFavorites } from '@/features/trading/useTrading';
import { formatPrice } from '@/features/trading/formatPrice';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing, radius, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<CommerceStackParamList>;

type ModeFilter = 'all' | ListingMode;

const MODE_OPTIONS: Array<{ id: ModeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sell', label: 'For sale' },
  { id: 'buy', label: 'Wanted' },
];

export function MarketplaceScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const { coords, requestPermission } = useUserLocation();
  const [tab, setTab] = useState<'browse' | 'saved'>('browse');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  const browseMode = modeFilter === 'all' ? undefined : modeFilter;
  const browse = useBrowseListings(tab === 'browse' ? coords : null, {
    mode: browseMode,
  });
  const saved = useFavorites(tab === 'saved');

  const data = tab === 'browse' ? browse.listings : saved.favorites;
  const loading = tab === 'browse' ? browse.loading : saved.loading;
  const refresh = tab === 'browse' ? browse.refresh : saved.refresh;

  const renderItem = useCallback(
    ({ item }: { item: ListingSummary }) => (
      <ListingCard item={item} onPress={() => nav.navigate('ListingDetail', { listingId: item.id })} />
    ),
    [nav],
  );

  const emptyTitle =
    tab === 'saved'
      ? 'No saved listings'
      : modeFilter === 'buy'
        ? 'No wanted posts nearby'
        : modeFilter === 'sell'
          ? 'No items for sale nearby'
          : 'No listings nearby';

  const emptyBody =
    tab === 'saved'
      ? "You haven't saved any listings yet."
      : 'Be the first to post something near you.';

  return (
    <View style={S.container}>
      <ScreenHeader
        title="Marketplace"
        right={
          <TouchableOpacity
            onPress={() => nav.navigate('ListingCreate')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Create listing"
          >
            <Icon name="plus-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={S.tabs}>
        {(['browse', 'saved'] as const).map((t) => (
          <TouchableOpacity key={t} style={[S.tab, tab === t && S.tabActive]} onPress={() => setTab(t)}>
            <Text style={[S.tabText, tab === t && S.tabTextActive]}>
              {t === 'browse' ? 'Nearby' : 'Saved'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'browse' ? (
        <View style={S.modeRow}>
          {MODE_OPTIONS.map((opt) => {
            const active = modeFilter === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setModeFilter(opt.id)}
                style={[S.modeChip, active && S.modeChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Show ${opt.label} listings`}
              >
                <Text style={[S.modeChipText, active && S.modeChipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={data}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={S.row}
        contentContainerStyle={S.grid}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
          ) : (
            <EmptyState
              variant="plain"
              icon={tab === 'browse' ? 'storefront-outline' : 'heart-outline'}
              title={emptyTitle}
              body={emptyBody}
              actionLabel={tab === 'browse' ? (modeFilter === 'buy' ? 'Post a wanted' : 'Sell an item') : undefined}
              onAction={
                tab === 'browse'
                  ? () =>
                      nav.navigate('ListingCreate', {
                        mode: modeFilter === 'buy' ? 'buy' : 'sell',
                      })
                  : undefined
              }
            />
          )
        }
      />
    </View>
  );
}

function ListingCard({
  item,
  onPress,
}: {
  item: ListingSummary;
  onPress: () => void;
}): React.JSX.Element {
  const isWanted = item.mode === 'buy';
  return (
    <TouchableOpacity style={S.card} activeOpacity={0.85} onPress={onPress}>
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} />
      ) : (
        <View style={[S.thumb, S.thumbPlaceholder]}>
          <Icon name="image-off-outline" size={28} color={colors.borderStrong} />
        </View>
      )}
      {item.status !== 'active' ? (
        <View style={S.statusPill}>
          <Text style={S.statusText}>{item.status}</Text>
        </View>
      ) : isWanted ? (
        <View style={S.wantedPill}>
          <Text style={S.wantedText}>Wanted</Text>
        </View>
      ) : null}
      {item.favoritedByMe ? <Icon name="heart" size={18} color={colors.danger} style={S.heart} /> : null}
      <Text style={S.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={S.cardPrice}>{formatPrice(item.priceCents, item.currency)}</Text>
      <Text style={S.cardCategory} numberOfLines={1}>
        {item.category}
      </Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  tabTextActive: { color: colors.onPrimary },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: 10,
  },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '700' },
  modeChipTextActive: { color: colors.onPrimary },
  grid: { padding: spacing.md, paddingBottom: 40 },
  row: { gap: spacing.md },
  card: {
    flex: 1,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  statusText: { color: colors.warning, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  wantedPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.entityWanted,
  },
  wantedText: { color: colors.textPrimary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  heart: { position: 'absolute', top: 14, right: 14 },
  cardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardPrice: { color: colors.primary, fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardCategory: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
