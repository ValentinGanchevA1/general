// apps/mobile/src/features/pulse/PulseScreen.tsx
//
// Pulse — activity hub + stories.
//   Layout: header + story strip + filter chips + nearby strip + cards + trending
//   Data:   `/feed` for cards; stories.nearby for PulseStrip; discovery for nearby.
//
// 2026-08-29: Chat / Waves / Matches removed from Pulse filters.
//             Those live in Interactions. Pulse keeps Alerts + Trades (+ stories).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { ActivityItem, ActivityType, StoryCard, Viewport } from '@g88/shared';
import { canPostStory, storyGateMessage } from '@g88/shared';

import type { PulseFilter, RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchFeed, clearPendingFilter } from './pulseSlice';
import { useUserLocation } from '@/features/location/useUserLocation';
import {
  fetchNearbyStories,
  storyReceived,
} from '@/features/stories/storiesSlice';
import { PulseStrip } from '@/features/stories/components/PulseStrip';
import { colors } from '@/theme';
import { StoryViewer } from '@/features/stories/components/StoryViewer';
import { StoryCreateSheet } from '@/features/stories/components/StoryCreateSheet';
import { pickAndUploadStoryMedia } from '@/features/stories/storyMedia';
import { useSocket } from '@/realtime/useSocket';
import { track } from '@/lib/analytics';

import { ActivityCard } from './components/ActivityCard';
import { NearbyPeopleStrip } from './components/NearbyPeopleStrip';
import { TrendingStrip } from './components/TrendingStrip';
import { useTrendingNearby } from './useTrendingNearby';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<TabParamList, 'Pulse'>;

interface FilterDef { key: PulseFilter; label: string; type: ActivityType | null }

/** Pulse filters after Interactions hub split: no chats / waves / matches. */
const FILTERS: FilterDef[] = [
  { key: 'all',      label: 'All',     type: null },
  { key: 'listings', label: 'Trades',  type: 'listing' },
  { key: 'alerts',   label: 'Alerts',  type: 'alert' },
];

const ALLOWED_FILTER_KEYS = new Set(FILTERS.map((f) => f.key));

function resolveFilter(raw: PulseFilter | undefined): PulseFilter {
  if (raw && ALLOWED_FILTER_KEYS.has(raw)) return raw;
  return 'all';
}

/** ~2km box around the user for nearby story query when map viewport is unavailable. */
function viewportAround(
  lat: number,
  lng: number,
  delta = 0.02,
): Viewport {
  return {
    ne: { lat: lat + delta / 2, lng: lng + delta / 2 },
    sw: { lat: lat - delta / 2, lng: lng - delta / 2 },
  };
}

export function PulseScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();

  const { items, loading, error, pendingFilter } = useAppSelector((s) => s.pulse);
  const discoveryPoints = useAppSelector((s) => s.discovery.points);
  const nearbyStories = useAppSelector((s) => s.stories.nearby);
  const profile = useAppSelector((s) => s.profile.profile);
  const { topics: trendingTopics } = useTrendingNearby();
  const { coords: myCoords, requestPermission } = useUserLocation();
  const { on } = useSocket();

  const [filter, setFilter] = useState<PulseFilter>(() => resolveFilter(route.params?.filter));
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  // Sync filter from navigation params (deep link / tab param change).
  useEffect(() => {
    if (route.params?.filter == null) return;
    const next = resolveFilter(route.params.filter);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from route
    setFilter(next);
  }, [route.params?.filter]);

  useEffect(() => {
    if (!pendingFilter) return;
    const next = resolveFilter(pendingFilter as PulseFilter);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from redux pending
    setFilter(next);
    dispatch(clearPendingFilter());
  }, [pendingFilter, dispatch]);

  const load = useCallback(() => {
    const f = FILTERS.find((x) => x.key === filter);
    void dispatch(fetchFeed(f?.type ? { types: [f.type] } : {}));
  }, [dispatch, filter]);

  const loadStories = useCallback(() => {
    if (!myCoords) return;
    void dispatch(
      fetchNearbyStories({
        viewport: viewportAround(myCoords.lat, myCoords.lng),
        zoom: 14,
      }),
    );
  }, [dispatch, myCoords]);

  useFocusEffect(
    useCallback(() => {
      void requestPermission();
      load();
      loadStories();
    }, [requestPermission, load, loadStories]),
  );

  useEffect(() => {
    const unsub = on('story:new', (e) => {
      dispatch(storyReceived(e));
    });
    return unsub;
  }, [on, dispatch]);

  const filtered = useMemo(() => {
    // Never show chat / wave / match cards in Pulse (moved to Interactions).
    const withoutPeople = items.filter(
      (i) => i.type !== 'chat' && i.type !== 'wave' && i.type !== 'match',
    );
    const f = FILTERS.find((x) => x.key === filter);
    return f?.type ? withoutPeople.filter((i) => i.type === f.type) : withoutPeople;
  }, [items, filter]);

  const onTap = useCallback((it: ActivityItem): void => {
    const { screen, params } = it.deepLink;
    // Nested stack screens — always go through openRootScreen so the tab
    // navigator does not swallow the push.
    if (
      screen === 'ListingDetail' ||
      screen === 'EventDetail' ||
      screen === 'OfferDetail' ||
      screen === 'TradeDetail'
    ) {
      openRootScreen(navigation, screen as 'ListingDetail' | 'EventDetail', params);
      return;
    }
    if (screen === 'Main') {
      navigation.navigate('Main', params as never);
      return;
    }
    // Fallback: listing/offer activity without a typed deepLink still opens
    // the listing when the activity id is a listing id.
    if (it.type === 'listing' && it.id) {
      openRootScreen(navigation, 'ListingDetail', { listingId: it.id });
      return;
    }
    (navigation.navigate as (s: string, p?: object) => void)(screen, params);
  }, [navigation]);

  const storyEligibility = useMemo(() => {
    if (!profile) return { allowed: false as const, reason: 'email_unverified' as const };
    return canPostStory({
      verification: profile.verification,
      createdAt: profile.createdAt,
    });
  }, [profile]);

  const onOpenStory = useCallback((story: StoryCard, index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
    track('story.open', { storyId: story.id, index, surface: 'pulse' });
  }, []);

  const onCreatePress = useCallback(() => {
    if (!storyEligibility.allowed) {
      const reason = storyEligibility.reason;
      const buttons =
        reason === 'email_unverified'
          ? [
              { text: 'Cancel', style: 'cancel' as const },
              {
                text: 'Verify email',
                onPress: () => openRootScreen(navigation, 'EmailVerification'),
              },
            ]
          : [{ text: 'OK' }];
      Alert.alert('Stories', storyGateMessage(reason), buttons);
      return;
    }
    setCreateOpen(true);
    track('story.create_open', { surface: 'pulse' });
  }, [storyEligibility, navigation]);

  const emptyCopy = useMemo(() => {
    switch (filter) {
      case 'listings':
        return {
          title: 'No trades nearby',
          hint: 'Post a listing from Create, or wait for neighbours to list something.',
        };
      case 'alerts':
        return {
          title: 'No local alerts',
          hint: 'Post an alert from the map Create button when something is happening nearby.',
        };
      default:
        return {
          title: 'Quiet around here',
          hint: 'Pull to refresh, or post a story above. Chats and waves live in Interactions.',
        };
    }
  }, [filter]);

  const Header = (
    <View>
      <View style={S.headerBar}>
        <Text style={S.headerTitle}>Pulse</Text>
      </View>

      <PulseStrip
        onOpenStory={onOpenStory}
        onCreatePress={onCreatePress}
        canCreate={storyEligibility.allowed}
      />

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={S.chips} contentContainerStyle={S.chipsContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[S.chip, active && S.chipActive]}
              onPress={() => setFilter(f.key)}
              testID={`pulse-filter-${f.key}`}
            >
              <Text style={[S.chipText, active && S.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <NearbyPeopleStrip
        points={discoveryPoints}
        onTapUser={(userId) => navigation.navigate('UserProfile', { userId })}
      />
    </View>
  );

  const Footer = (
    <View style={S.footer}>
      <TrendingStrip
        topics={trendingTopics}
        onTapTopic={(t) =>
          navigation.navigate('AlertComposer', { presetCategory: 'general', presetTag: t })
        }
      />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={S.container}>
        {Header}
        <View style={S.center}><ActivityIndicator color={colors.primary} /></View>
        <StoryViewer
          stories={nearbyStories}
          initialIndex={viewerIndex}
          visible={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
        <StoryCreateSheet
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          location={myCoords}
          pickAndUpload={pickAndUploadStoryMedia}
        />
      </View>
    );
  }
  if (error) {
    return (
      <View style={S.container}>
        {Header}
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={S.retry}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
        <StoryViewer
          stories={nearbyStories}
          initialIndex={viewerIndex}
          visible={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
        <StoryCreateSheet
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          location={myCoords}
          pickAndUpload={pickAndUploadStoryMedia}
        />
      </View>
    );
  }

  return (
    <View style={S.container}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ActivityCard item={item} onPress={() => onTap(item)} />}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        ListEmptyComponent={
          <View style={S.empty}>
            <MCI name="pulse" size={40} color={colors.borderStrong} />
            <Text style={S.emptyTitle}>{emptyCopy.title}</Text>
            <Text style={S.emptyBody}>{emptyCopy.hint}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              load();
              loadStories();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      />

      <StoryViewer
        stories={nearbyStories}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
      <StoryCreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        location={myCoords}
        pickAndUpload={pickAndUploadStoryMedia}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },

  chips: { maxHeight: 50 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.danger, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBody: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  footer: { paddingTop: 20, paddingBottom: 30 },
});
