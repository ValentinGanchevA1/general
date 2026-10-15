// apps/mobile/src/screens/MarketplaceScreen.tsx
// Browse / Saved listings — grid + mode chips (All / For sale / Wanted).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

import type { ListingSummary } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { useMarketplace } from '@/features/marketplace/useMarketplace';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonMarketGrid } from '@/components/Skeleton';
import { colors, spacing, radius, fontSize, useAppTheme } from '@/theme';

type Nav = NativeStackNavigationProp<CommerceStackParamList>;
type Tab = 'browse' | 'saved';
type Mode = 'all' | 'sell' | 'buy';

const MODE_CHIPS: { key: Mode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sell', label: 'For sale' },
  { key: 'buy', label: 'Wanted' },
];

export function MarketplaceScreen(): React.JSX.Element {
  const { colors: themeColors } = useAppTheme();

  const nav = useNavigation<Nav>();
  const { coords } = useUserLocation();
  const [tab, setTab] = useState<Tab>('browse');
  const [mode, setMode] = useState<Mode>('all');

  const { items, loading, error, refresh, loadMore, hasMore } = useMarketplace({
    tab,
    mode,
    lat: coords?.lat,
    lng: coords?.lng,
  });

  useEffect(() => {
    void refresh();
  }, [tab, mode, refresh]);

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: ListingSummary }) => (
      <TouchableOpacity
        style={S.card}
        onPress={() => nav.navigate('ListingDetail', { listingId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={S.thumb} />
        ) : (
          <View style={[S.thumb, S.thumbPlaceholder]} />
        )}
        <View style={S.cardBody}>
          <Text style={S.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={S.cardMeta} numberOfLines={1}>
            {[item.priceLabel, item.distanceLabel, item.category]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [nav],
  );

  return (
    <View style={[S.root, { backgroundColor: themeColors.bg }]}>
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
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[S.tabText, tab === t && S.tabTextActive]}>
              {t === 'browse' ? 'Browse' : 'Saved'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'browse' ? (
        <View style={S.modeRow}>
          {MODE_CHIPS.map((c) => (
            <Pressable
              key={c.key}
              style={[S.modeChip, mode === c.key && S.modeChipActive]}
              onPress={() => setMode(c.key)}
            >
              <Text style={[S.modeChipText, mode === c.key && S.modeChipTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <SkeletonMarketGrid />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={S.row}
          contentContainerStyle={S.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (hasMore) void loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            error ? (
              <EmptyState
                variant="plain"
                icon="alert-circle-outline"
                title="Couldn't load listings"
                body="Check your connection and try again."
                actionLabel="Retry"
                onAction={onRefresh}
              />
            ) : (
              <EmptyState
                variant="plain"
                icon="storefront-outline"
                title={tab === 'saved' ? 'No saved listings' : 'Nothing nearby'}
                body={
                  tab === 'saved'
                    ? 'Save listings from the detail screen."
                    : 'Create a listing or widen your map area.'
                }
                actionLabel={tab === 'browse' ? 'Sell an item' : undefined}
                onAction={
                  tab === 'browse'
                    ? () => nav.navigate('ListingCreate', { mode: 'sell' })
                    : undefined
                }
              />
            )
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerAction: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: fontSize.sm },
  tabTextActive: { color: colors.primary },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
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
  modeChipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  modeChipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  list: { padding: spacing.sm, flexGrow: 1 },
  row: { gap: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  thumb: { width: '100%', height: 120, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { backgroundColor: colors.surfaceAlt },
  cardBody: { padding: spacing.sm },
  cardTitle: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.sm },
  cardMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
});
