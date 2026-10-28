// apps/mobile/src/screens/MarketplaceScreen.tsx
//
// Marketplace browse surface: reference-style category tabs + thumbnail grid.
// Existing listing DTOs remain the source of truth; service/job/deal sections
// are derived from listing category/title until the marketplace domain is split.

import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
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

import type { ListingSummary } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { toggleFavorite, useBrowseListings } from '@/features/trading/useTrading';
import { formatPrice } from '@/features/trading/formatPrice';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonMarketGrid } from '@/components/Skeleton';
import { spacing, radius, fontSize, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<CommerceStackParamList>;
type MarketplaceSection = 'for-sale' | 'services' | 'jobs' | 'local-deals';

type MarketTab = {
  key: MarketplaceSection;
  label: string;
};

const MARKET_TABS: readonly MarketTab[] = [
  { key: 'for-sale', label: 'For Sale' },
  { key: 'services', label: 'Services' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'local-deals', label: 'Local Deals' },
];

const SERVICE_TERMS = [
  'service',
  'services',
  'cleaning',
  'electrician',
  'plumber',
  'repair',
  'tutor',
  'beauty',
  'web development',
  'development service',
] as const;

const JOB_TERMS = [
  'job',
  'jobs',
  'hiring',
  'employment',
  'vacancy',
  'freelance',
  'gig',
] as const;

const DEAL_TERMS = [
  'deal',
  'deals',
  'local deal',
  'promotion',
  'discount',
  'special offer',
] as const;

function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function sectionForListing(listing: ListingSummary): MarketplaceSection | null {
  if (listing.mode !== 'sell') return null;

  const searchable = `${listing.category} ${listing.title}`.toLowerCase();
  if (includesAny(searchable, JOB_TERMS)) return 'jobs';
  if (includesAny(searchable, SERVICE_TERMS)) return 'services';
  if (includesAny(searchable, DEAL_TERMS)) return 'local-deals';
  return 'for-sale';
}

function fallbackIcon(section: MarketplaceSection): string {
  switch (section) {
    case 'services':
      return 'tools';
    case 'jobs':
      return 'briefcase-outline';
    case 'local-deals':
      return 'sale-outline';
    case 'for-sale':
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

function priceLabel(item: ListingSummary, section: MarketplaceSection): string {
  const price = formatPrice(item.priceCents, item.currency);
  return section === 'services' ? `From ${price}` : price;
}

function emptyCopy(section: MarketplaceSection): { title: string; body: string } {
  switch (section) {
    case 'services':
      return {
        title: 'No services nearby yet',
        body: 'Local service offers will appear here as they are posted.',
      };
    case 'jobs':
      return {
        title: 'No jobs nearby yet',
        body: 'Local jobs and gigs will appear here as they are posted.',
      };
    case 'local-deals':
      return {
        title: 'No local deals nearby yet',
        body: 'Nearby promotions and local offers will appear here.',
      };
    case 'for-sale':
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
  const [section, setSection] = useState<MarketplaceSection>('for-sale');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [favoriteBusy, setFavoriteBusy] = useState<Set<string>>(new Set());

  const browse = useBrowseListings(coords ?? null);

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

  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return browse.listings.filter((item) => {
      if (sectionForListing(item) !== section) return false;
      if (!normalizedQuery) return true;
      return `${item.title} ${item.category}`.toLowerCase().includes(normalizedQuery);
    });
  }, [browse.listings, query, section]);

  const handleFavorite = useCallback(async (item: ListingSummary): Promise<void> => {
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

  const renderItem = useCallback(({ item }: { item: ListingSummary }) => {
    const itemSection = sectionForListing(item) ?? 'for-sale';
    const favorited = favoriteOverrides[item.id] ?? item.favoritedByMe;
    const favoriteIsBusy = favoriteBusy.has(item.id);
    const distance = coords ? formatDistance(distanceMeters(coords, item.location)) : item.category;
    const meta = itemSection === 'for-sale' ? distance : `${item.category} · ${distance}`;

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
                name={fallbackIcon(itemSection)}
                size={40}
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
              size={24}
              color={favorited ? colors.actionPrimary : colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={S.cardBody}>
          <Text style={S.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={S.cardPrice} numberOfLines={1}>{priceLabel(item, itemSection)}</Text>
          <Text style={S.cardMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [S, colors.actionPrimary, colors.textPrimary, colors.textTertiary, coords, favoriteBusy, favoriteOverrides, handleFavorite, nav]);

  const empty = emptyCopy(section);
  const showErrorEmpty = browse.error != null && filteredData.length === 0 && !browse.loading;
  const showSearchEmpty = query.trim().length > 0 && filteredData.length === 0 && !browse.loading;

  return (
    <View style={S.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.marketTabs}
        style={S.marketTabsScroll}
      >
        {MARKET_TABS.map((tab) => {
          const active = section === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[S.marketTab, active && S.marketTabActive]}
              onPress={() => setSection(tab.key)}
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
            placeholder="Search Marketplace"
            placeholderTextColor={colors.textTertiary}
            style={S.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search marketplace listings"
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
        data={filteredData}
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
              body={`No ${MARKET_TABS.find((tab) => tab.key === section)?.label.toLowerCase() ?? 'marketplace'} results match “${query.trim()}”.`}
            />
          ) : (
            <EmptyState
              variant="plain"
              icon={fallbackIcon(section)}
              title={empty.title}
              body={empty.body}
              actionLabel="Create listing"
              onAction={() => nav.navigate('ListingCreate', { mode: 'sell' })}
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
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    marketTab: {
      minHeight: 42,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 12,
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
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderDefault,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    grid: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      flexGrow: 1,
    },
    row: {
      justifyContent: 'space-between',
    },
    card: {
      width: '48.5%',
      marginBottom: spacing.lg,
    },
    thumbnailWrap: {
      position: 'relative',
      width: '100%',
    },
    thumb: {
      width: '100%',
      aspectRatio: 1.36,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
    },
    thumbPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderDefault,
    },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderDefault,
    },
    cardBody: {
      paddingTop: 8,
      gap: 2,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      lineHeight: 20,
      fontWeight: '800',
    },
    cardPrice: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      lineHeight: 19,
      fontWeight: '700',
    },
    cardMeta: {
      color: colors.textTertiary,
      fontSize: fontSize.xs,
      lineHeight: 17,
      fontWeight: '500',
    },
  });
}
