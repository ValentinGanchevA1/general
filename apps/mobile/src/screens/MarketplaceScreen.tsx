// apps/mobile/src/screens/MarketplaceScreen.tsx
//
// P3.7 trading hub: nearby browse grid + Sell entry + saved toggle.
// Mode filter (All / For sale / Wanted) — same labels as map.

import React, { useCallback, useState } from 'react';
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

import type { ListingCard, ListingMode } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { useBrowseListings, useFavorites } from '@/features/trading/useTrading';
import { formatPrice } from '@/features/trading/formatPrice';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing, radius, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<CommerceStackParamList>;
type Tab = 'browse' | 'saved';
type ModeFilter = 'all' | ListingMode;

const MODE_OPTIONS: Array<{ value: ModeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'sell', label: 'For sale' },
  { value: 'buy', label: 'Wanted' },
];

export function MarketplaceScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const { coords } = useUserLocation();
  const [tab, setTab] = useState<Tab>('browse');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  const listingMode = modeFilter === 'all' ? undefined : modeFilter;
  const browse = useBrowseListings(coords ?? null, listingMode);
  const saved = useFavorites();

  const data = tab === 'browse' ? browse.listings : saved.listings;
  const loading = tab === 'browse' ? browse.loading : saved.loading;
  const refresh = tab === 'browse' ? browse.refresh : saved.refresh;

  const emptyTitle =
    tab === 'browse'
      ? modeFilter === 'buy'
        ? 'No wanted posts nearby'
        : modeFilter === 'sell'
          ? 'Nothing for sale nearby'
          : 'Nothing nearby yet'
      : 'No saved listings';
  const emptyBody =
    tab === 'browse'
      ? modeFilter === 'buy'
        ? 'Be the first to post what you are looking for.'
        : 'List something or widen your map region.'
      : 'Heart listings to keep them here.';

  const renderItem = useCallback(
    ({ item }: { item: ListingCard }) => (
      <TouchableOpacity
        style={S.card}
        activeOpacity={0.85}
        onPress={() => nav.navigate('ListingDetail', { listingId: item.id })}
      >
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} />
        ) : (
          <View style={[S.thumb, S.thumbPlaceholder]}>
            <Icon name="image-off-outline" size={28} color={colors.borderStrong} />
          </View>
        )}
        <View style={S.cardBody}>
          <Text style={S.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={S.cardPrice}>{formatPrice(item.priceCents, item.currency)}</Text>
          <Text style={S.cardMeta} numberOfLines={1}>
            {item.mode === 'buy' ? 'Wanted · ' : ''}{item.category}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [nav],
  );

  return (
    <View style={S.root}>
      <ScreenHeader
        title="Marketplace"
        right={
          <TouchableOpacity
            onPress={() => nav.navigate('ListingCreate', { mode: 'sell' })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sell an item"
          >
            <Text style={S.headerAction}>Sell</Text>
          </TouchableOpacity>
        }
        bordered
      />

      <View style={S.tabs}>
        {(['browse', 'saved'] as const).map((t) => (
          <Pressable
            key={t}
            style={[S.tab, tab === t && S.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[S.tabText, tab === t && S.tabTextActive]}>
              {t === 'browse' ? 'Nearby' : 'Saved'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'browse' ? (
        <View style={S.modeRow}>
          {MODE_OPTIONS.map((opt) => {
            const active = modeFilter === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[S.modeChip, active && S.modeChipActive]}
                onPress={() => setModeFilter(opt.value)}
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
              {...(tab === 'browse'
                ? {
                    actionLabel: modeFilter === 'buy' ? 'Post a wanted' : 'Sell an item',
                    onAction: () =>
                      nav.navigate('ListingCreate', {
                        mode: modeFilter === 'buy' ? 'buy' : 'sell',
                      }),
                  }
                : {})}
            />
          )
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerAction: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  modeChipTextActive: { color: colors.onPrimary },
  grid: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  row: { gap: spacing.md },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  thumb: { width: '100%', height: 120, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.sm, gap: 2 },
  cardTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  cardPrice: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: fontSize.xs },
});
