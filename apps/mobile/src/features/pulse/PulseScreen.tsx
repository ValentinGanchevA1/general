// apps/mobile/src/features/pulse/PulseScreen.tsx
//
// Pulse v2 — Nextdoor-style activity hub.
//   Layout: header + share-CTA + filter chips + nearby strip + cards + trending
//   Data:   `/feed` (existing) for cards; `discovery.points` for nearby strip;
//           mock array for trending until X4 lands.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { ActivityItem, ActivityType } from '@g88/shared';
import type { PulseFilter, RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchFeed, clearPendingFilter } from './pulseSlice';

import { ShareCTA } from './components/ShareCTA';
import { ActivityCard } from './components/ActivityCard';
import { NearbyPeopleStrip } from './components/NearbyPeopleStrip';
import { TrendingStrip } from './components/TrendingStrip';
import { useTrendingNearby } from './useTrendingNearby';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<TabParamList, 'Pulse'>;

interface FilterDef { key: PulseFilter; label: string; type: ActivityType | null }

const FILTERS: FilterDef[] = [
  { key: 'all',      label: 'All',     type: null },
  { key: 'chats',    label: 'Chats',   type: 'chat' },
  { key: 'waves',    label: 'Waves',   type: 'wave' },
  { key: 'listings', label: 'Trades',  type: 'listing' },
  { key: 'alerts',   label: 'Alerts',  type: 'alert' },
  { key: 'matches',  label: 'Matches', type: 'match' },
];

export function PulseScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();

  const { items, loading, error, pendingFilter } = useAppSelector((s) => s.pulse);
  const discoveryPoints = useAppSelector((s) => s.discovery.points);
  const { topics: trendingTopics } = useTrendingNearby();

  const [filter, setFilter] = useState<PulseFilter>(route.params?.filter ?? 'all');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  useEffect(() => {
    if (pendingFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilter(pendingFilter as PulseFilter);
      dispatch(clearPendingFilter());
    }
  }, [pendingFilter, dispatch]);

  const load = useCallback(() => {
    const f = FILTERS.find((x) => x.key === filter);
    void dispatch(fetchFeed(f?.type ? { types: [f.type] } : {}));
  }, [dispatch, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return f?.type ? items.filter((i) => i.type === f.type) : items;
  }, [items, filter]);

  const onTap = useCallback((it: ActivityItem): void => {
    const { screen, params } = it.deepLink;
    if (screen === 'Main') {
      navigation.navigate('Main', params as never);
    } else {
      (navigation.navigate as (s: string, p?: object) => void)(screen, params);
    }
  }, [navigation]);

  const openAlertComposer = useCallback(() => {
    navigation.navigate('AlertComposer', { presetCategory: 'general' });
  }, [navigation]);

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
          hint: "Share what's happening around you with the button above.",
        };
      case 'matches':
        return {
          title: 'No matches yet',
          hint: 'A match appears when someone waves you back. Keep waving on the map.',
        };
      default:
        return {
          title: 'Quiet around here',
          hint: "Pull to refresh, or share what's happening.",
        };
    }
  }, [filter]);

  const Header = (
    <View>
      <View style={S.headerBar}>
        <Text style={S.headerTitle}>Pulse</Text>
      </View>

      <ShareCTA onPress={openAlertComposer} />

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
        <View style={S.center}><ActivityIndicator color="#00d4ff" /></View>
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
            <MCI name="pulse" size={40} color="#2a2a4a" />
            <Text style={S.emptyTitle}>{emptyCopy.title}</Text>
            <Text style={S.emptyBody}>{emptyCopy.hint}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#00d4ff" />
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },

  chips: { maxHeight: 50 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
  },
  chipActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#0a0a0f', fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#ff6b6b', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  retryText: { color: '#0a0a0f', fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBody: { color: '#666', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  footer: { paddingTop: 20, paddingBottom: 30 },
});
