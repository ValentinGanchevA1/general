// apps/mobile/src/features/pulse/PulseScreen.tsx
//
// Pulse — activity hub + stories.
//   Layout: header + story strip + filter chips + activity feed.
//   Data:   `/feed` for cards; stories.nearby for PulseStrip; discovery for nearby.
//   Stories live here (not on Map) so Map stays map-first.

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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { FeedItem, StoryCard } from '@g88/shared';
import { canPostStory, storyGateMessage } from '@g88/shared';

import type { RootStackParamList, TabParamList, PulseFilter } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { fetchNearbyStories } from '@/features/stories/storiesSlice';
import { PulseStrip } from '@/features/stories/components/PulseStrip';
import { colors } from '@/theme';
import { StoryViewer } from '@/features/stories/components/StoryViewer';
import { StoryCreateSheet } from '@/features/stories/components/StoryCreateSheet';
import { pickAndUploadStoryMedia } from '@/features/stories/storyMedia';
import { ActivityCard } from './ActivityCard';
import { TrendingStrip } from './TrendingStrip';
import { usePulseFeed } from './usePulseFeed';

const FILTERS: { key: PulseFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chats', label: 'Chats' },
  { key: 'waves', label: 'Waves' },
  { key: 'listings', label: 'Trades' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'matches', label: 'Matches' },
];

export function PulseScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabParamList, 'Pulse'>>();
  const dispatch = useAppDispatch();
  const { coords: myCoords } = useUserLocation();
  const { items, trendingTopics, loading, error, load } = usePulseFeed();
  const nearbyStories = useAppSelector((s) => s.stories.nearby);
  const me = useAppSelector((s) => s.auth.user);

  const filter = route.params?.filter ?? 'all';
  const setFilter = (f: PulseFilter) => {
    navigation.setParams({ filter: f });
  };

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const storyEligibility = useMemo(() => {
    if (!me) return { allowed: false as const, reason: 'auth' as const };
    return canPostStory({
      emailVerified: Boolean((me as { emailVerified?: boolean }).emailVerified),
      createdAt: (me as { createdAt?: string }).createdAt ?? new Date().toISOString(),
    });
  }, [me]);

  const loadStories = useCallback(() => {
    if (!myCoords) return;
    void dispatch(
      fetchNearbyStories({
        viewport: {
          ne: { lat: myCoords.lat + 0.05, lng: myCoords.lng + 0.05 },
          sw: { lat: myCoords.lat - 0.05, lng: myCoords.lng - 0.05 },
        },
        zoom: 12,
      }),
    );
  }, [dispatch, myCoords]);

  useEffect(() => {
    load();
    loadStories();
  }, [load, loadStories]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'chats') return items.filter((i) => i.kind === 'chat');
    if (filter === 'waves') return items.filter((i) => i.kind === 'wave');
    if (filter === 'listings') return items.filter((i) => i.kind === 'listing');
    if (filter === 'alerts') return items.filter((i) => i.kind === 'alert');
    if (filter === 'matches') return items.filter((i) => i.kind === 'match');
    return items;
  }, [items, filter]);

  const onTap = (item: FeedItem) => {
    if (item.kind === 'chat' && item.conversationId) {
      navigation.navigate('Chat', {
        conversationId: item.conversationId,
        otherUserName: item.title,
      });
    } else if (item.kind === 'wave' && item.otherUserId) {
      navigation.navigate('UserProfile', { userId: item.otherUserId });
    } else if (item.kind === 'listing' && item.listingId) {
      navigation.navigate('ListingDetail', { listingId: item.listingId });
    } else if (item.kind === 'alert') {
      // stay on pulse
    } else if (item.kind === 'match' && item.otherUserId) {
      navigation.navigate('UserProfile', { userId: item.otherUserId });
    }
  };

  const onOpenStory = (story: StoryCard, index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const onCreatePress = () => {
    if (!storyEligibility.allowed) {
      const reason = storyEligibility.reason;
      const buttons =
        reason === 'email'
          ? [
              { text: 'Cancel', style: 'cancel' as const },
              {
                text: 'Verify email',
                onPress: () => navigation.navigate('EmailVerification'),
              },
            ]
          : [{ text: 'OK', style: 'cancel' as const }];
      Alert.alert('Stories', storyGateMessage(reason), buttons);
      return;
    }
    setCreateOpen(true);
  };

  const emptyCopy = useMemo(() => {
    switch (filter) {
      case 'chats':
        return {
          title: 'No chats yet',
          hint: 'Wave someone on the map — when they wave back, your chat shows up here.',
        };
      case 'waves':
        return {
          title: 'No waves yet',
          hint: 'Send a wave from the map or a profile. Incoming and outgoing waves land here.',
        };
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
      case 'matches':
        return {
          title: 'No matches yet',
          hint: 'A match appears when someone waves you back. Keep waving on the map.',
        };
      default:
        return {
          title: 'Quiet around here',
          hint: 'Pull to refresh, or post a story above.',
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
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.chips}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[S.chip, filter === f.key && S.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[S.chipText, filter === f.key && S.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
        contentContainerStyle={{ paddingBottom: 24 }}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  chips: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  errorText: { color: colors.danger, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBody: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  footer: { paddingTop: 20, paddingBottom: 30 },
});
