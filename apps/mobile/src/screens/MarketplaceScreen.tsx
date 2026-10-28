// apps/mobile/src/screens/MarketplaceScreen.tsx
// Reference-style Marketplace backed by first-class marketplace kinds.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { MarketplaceKind, MarketplaceListingSummary } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonMarketGrid } from '@/components/Skeleton';
import { useUserLocation } from '@/features/location/useUserLocation';
import { useBrowseMarketplace } from '@/features/trading/useMarketplace';
import { formatPrice } from '@/features/trading/formatPrice';
import { toggleFavorite } from '@/features/trading/useTrading';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<CommerceStackParamList>;

type MarketTab = {
  key: MarketplaceKind;
  label: string;
};

const MARKET_TABS: readonly MarketTab[] = [
  { key: 'for_sale', label: 'For Sale' },
  { key: 'service', label: 'Services' },
  { key: 'job', label: 'Jobs' },
  { key: 'local_deal', label: 'Local Deals' },
];

function fallbackIcon(kind: MarketplaceKind): string {
  switch (kind) {
    case 'service':
      return 'tools';
    case 'job':
      return 'briefcase-outline';
    case 'local_deal':
      return 'sale-outline';
    case 'for_sale':
    default:
      return 'shopping-outline';
  }
}

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const earthRadiusM = 6_371_000;
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.max(1, Math.round(meters))} m`;
  const km = meters / 1_000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function priceLabel(item: MarketplaceListingSummary): string {
  const price = formatPrice(item.priceCents, item.currency);
  return item.marketplaceKind === 'service' ? `From ${price}` : price;
}

function emptyCopy(kind: MarketplaceKind): { title: string; body: string } {
  switch (kind) {
    case 'service':
      return {
        title: 'No services nearby yet',
        body: 'Local service offers will appear here as they are posted.',
      };
    case 'job':
      return {
        title: 'No jobs nearby yet',
        body: 'Local jobs and gigs will appear here as they are posted.',
      };
    case 'local_deal':
      return {
        title: 'No local deals nearby yet',
        body: 'Nearby promotions and local offers will appear here.',
      };
    case 'for_sale':
    default:
      return {
        title: 'Nothing for sale nearby',
        body: 'List something or widen your map region.',
      };
  }
}

export function MarketplaceScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const S = useMemo(() => createStyles(colors), [colors]);
  const nav = useNavigation<Nav>();
  const { coords } = useUserLocation();
  const [marketplaceKind, setMarketplaceKind] = useState<MarketplaceKind>('for_sale');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [favoriteBusy, setFavoriteBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const browse = useBrowseMarketplace(coords ?? null, {
    marketplaceKind,
    ...(debouncedQuery ? { query: debouncedQuery } : {}),
  });

  useLayoutEffect(() => {
    nav.setOptions({
      title: 'Marketplace',
      headerTitleAlign: 'center',
      headerBackVisible: false,
      headerShadowVisible: false,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            if (searchOpen) {
              setQuery('');
              setDebouncedQuery('');
              setSearchOpen(false);
            } else {
              setSearchOpen(true);
            }
          }}
          style={S.headerIconButton}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close marketplace search' : 'Search marketplace'}
        >
          <Icon
            name={searchOpen ? 'close' : 'magnify'}
            size={27}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      ),
    });
  }, [S.headerIconButton, colors.textPrimary, nav, searchOpen]);

  const visibleListings = useMemo(() => {
    const immediateQuery = query.trim().toLowerCase();
    return browse.listings.filter((item) => {
      if (item.marketplaceKind !== marketplaceKind) return false;
      if (!immediateQuery) return true;
      return `${item.title} ${item.category}`.toLowerCase().includes(immediateQuery);
    });
  }, [browse.listings, marketplaceKind, query]);

  const handleFavorite = useCallback(async (item: MarketplaceListingSummary): Promise<void> => {
    if (favoriteBusy.has(item.id)) return;
    const previous = favoriteOverrides[item.id] ?? item.favoritedByMe;

    setFavoriteOverrides((current) => ({ ...current, [item.id]: !previous }));
    setFavoriteBusy((current) => new Set(current).add(item.id));
    try {
      const result = await toggleFavorite(item.id);
      setFavoriteOverrides((current) => ({ ...current, [item.id]: result.favorited }));
    } catch {
      setFavoriteOverrides((current) => ({ ...current, [item.id]: previous }));
    } finally {
      setFavoriteBusy((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }, [favoriteBusy, favoriteOverrides]);

  const renderItem = useCallback(({ item }: { item: MarketplaceListingSummary }) => {
    const favorited = favoriteOverrides[item.id] ?? item.favoritedByMe;
    const favoriteIsBusy = favoriteBusy.has(item.id);
    const distance = coords ? formatDistance(distanceMeters(coords, item.location)) : null;
    const meta = [item.marketplaceKind === 'for_sale' ? null : item.category, distance]
      .filter((value): value is string => Boolean(value))
      .join(' · ');

    return (
      <TouchableOpacity
        style={S.card}
        activeOpacity={0.86}
        onPress={() => nav.navigate('ListingDetail', { listingId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={S.thumbnailWrap}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} resizeMode="cover" />
          ) : (
            <View style={[S.thumb, S.thumbPlaceholder]}>
              <Icon
                name={fallbackIcon(item.marketplaceKind)}
                size={42}
                color={colors.textTertiary}
              />
            </View>
          )}
          <Pressable
            style={S.favoriteButton}
            disabled={favoriteIsBusy}
            hitSlop={8}
            onPress={() => { void handleFavorite(item); }}
            accessibilityRole="button"
            accessibilityLabel={favorited ? `Remove ${item.title} from saved` : `Save ${item.title}`}
            accessibilityState={{ selected: favorited, disabled: favoriteIsBusy }}
          >
            <Icon
              name={favorited ? 'heart' : 'heart-outline'}
              size={23}
              color={favorited ? colors.actionPrimary : colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={S.cardBody}>
          <Text style={S.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={S.cardPrice} numberOfLines={1}>{priceLabel(item)}</Text>
          {meta ? <Text style={S.cardMeta} numberOfLines={1}>{meta}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  }, [S, colors.actionPrimary, colors.textPrimary, colors.textTertiary, coords, favoriteBusy, favoriteOverrides, handleFavorite, nav]);

  const empty = emptyCopy(marketplaceKind);
  const showErrorEmpty = browse.error != null && visibleListings.length === 0 && !browse.loading;
  const showSearchEmpty = query.trim().length > 0 && visibleListings.length === 0 && !browse.loading;
  const activeLabel = MARKET_TABS.find((tab) => tab.key === marketplaceKind)?.label ?? 'Marketplace';

  return (
    <View style={S.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.marketTabs}
        style={S.marketTabsScroll}
      >
        {MARKET_TABS.map((tab) => {
          const active = marketplaceKind === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[S.marketTab, active && S.marketTabActive]}
              onPress={() => setMarketplaceKind(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <Text style={[S.marketTabText, active && S.marketTabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {searchOpen ? (
        <View style={S.searchRow}>
          <Icon name="magnify" size={21} color={colors.textTertiary} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${activeLabel}`}
            placeholderTextColor={colors.textTertiary}
            style={S.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={`Search ${activeLabel}`}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear marketplace search"
            >
              <Icon name="close-circle" size={20} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={visibleListings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={S.row}
        contentContainerStyle={S.grid}
        refreshControl={(
          <RefreshControl
            refreshing={browse.loading}
            onRefresh={browse.refresh}
            tintColor={colors.actionPrimary}
            colors={[colors.actionPrimary]}
            progressBackgroundColor={colors.surface}
          />
        )}
        ListEmptyComponent={
          browse.loading ? (
            <SkeletonMarketGrid count={6} />
          ) : showErrorEmpty ? (
            <EmptyState
              variant="plain"
              icon="alert-circle-outline"
              title="Couldn't load Marketplace"
              body="Check your connection and try again."
              actionLabel="Retry"
              onAction={browse.refresh}
            />
          ) : showSearchEmpty ? (
            <EmptyState
              variant="plain"
              icon="magnify"
              title="No matching results"
              body={`No ${activeLabel.toLowerCase()} match “${query.trim()}”.`}
            />
          ) : (
            <EmptyState
              variant="plain"
              icon={fallbackIcon(marketplaceKind)}
              title={empty.title}
              body={empty.body}
              actionLabel="Create"
              onAction={() => nav.navigate('ListingCreate', { mode: 'sell', marketplaceKind })}
            />
          )
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    marketTabsScroll: {
      flexGrow: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    marketTabs: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    marketTab: {
      minHeight: 42,
      justifyContent: 'center',
      paddingHorizontal: 17,
      borderRadius: radius.pill,
      backgroundColor: 'transparent',
    },
    marketTabActive: {
      backgroundColor: colors.actionPrimary,
    },
    marketTabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    marketTabTextActive: {
      color: colors.onPrimary,
    },
    searchRow: {
      minHeight: 46,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      backgroundColor: colors.surfaceSecondary,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingVertical: 8,
    },
    grid: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: 40,
    },
    row: {
      gap: spacing.md,
    },
    card: {
      flex: 1,
      minWidth: 0,
      marginBottom: spacing.lg,
    },
    thumbnailWrap: {
      position: 'relative',
      width: '100%',
    },
    thumb: {
      width: '100%',
      height: 132,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceSecondary,
    },
    thumbPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderDefault,
    },
    cardBody: {
      paddingTop: spacing.sm,
      gap: 3,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '800',
      lineHeight: 20,
    },
    cardPrice: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    cardMeta: {
      color: colors.textTertiary,
      fontSize: fontSize.xs,
      lineHeight: 17,
    },
  });
}
