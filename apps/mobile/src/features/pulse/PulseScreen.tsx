// apps/mobile/src/features/pulse/PulseScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
  useNavigation, useFocusEffect, useRoute, type RouteProp,
} from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ActivityItem, ActivityType } from '@g88/shared';
import type { RootStackParamList, TabParamList, PulseFilter } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchFeed, clearPendingFilter } from '@/features/pulse/pulseSlice';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<TabParamList, 'Pulse'>;

const FILTERS: { key: PulseFilter; label: string; type: ActivityType | null }[] = [
  { key: 'all',      label: 'All',     type: null },
  { key: 'chats',    label: 'Chats',   type: 'chat' },
  { key: 'waves',    label: 'Waves',   type: 'wave' },
  { key: 'listings', label: 'Trades',  type: 'listing' },
  { key: 'alerts',   label: 'Alerts',  type: 'alert' },
  { key: 'matches',  label: 'Matches', type: 'match' },
];

const ICON_BY_TYPE: Record<ActivityType, string> = {
  chat: 'message-text', wave: 'hand-wave', listing: 'tag', alert: 'bullhorn', match: 'heart',
};

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Row({ item, onPress }: { item: ActivityItem; onPress: () => void }): React.JSX.Element {
  const initials = (item.actorName ?? '?')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity style={S.row} onPress={onPress}>
      <View style={[S.dot, { opacity: item.unread ? 1 : 0 }]} />
      <View style={S.avatar}><Text style={S.avatarText}>{initials}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={S.rowTop}>
          <Text style={[S.rowTitle, item.unread && S.rowTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={S.rowTime}>{relTime(item.createdAt)}</Text>
        </View>
        <Text style={S.rowPreview} numberOfLines={1}>{item.preview}</Text>
      </View>
      <MCI name={ICON_BY_TYPE[item.type]} size={18} color="#666" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

export function PulseScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { items, loading, error, pendingFilter } = useAppSelector((s) => s.pulse);
  const [filter, setFilter] = useState<PulseFilter>(route.params?.filter ?? 'all');

  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  useEffect(() => {
    if (pendingFilter) {
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

  const onTap = (it: ActivityItem): void => {
    const { screen, params } = it.deepLink;
    if (screen === 'Main') {
      navigation.navigate('Main', params as never);
    } else {
      navigation.navigate(screen as keyof RootStackParamList, params as never);
    }
  };

  return (
    <View style={S.container}>
      <View style={S.header}><Text style={S.headerTitle}>Pulse</Text></View>

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
            >
              <Text style={[S.chipText, active && S.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color="#00d4ff" /></View>
      ) : error ? (
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={S.retry}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <MCI name="pulse" size={40} color="#2a2a4a" />
          <Text style={S.emptyTitle}>Quiet around here</Text>
          <Text style={S.emptyBody}>Pull to refresh, or tap + below.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <Row item={item} onPress={() => onTap(item)} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor="#00d4ff" />
          }
          contentContainerStyle={{ paddingBottom: 140 }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0f' },
  header:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle:    { color: '#fff', fontSize: 28, fontWeight: '700' },
  chips:          { maxHeight: 50 },
  chipsContent:   { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a' },
  chipActive:     { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText:       { color: '#aaa', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#0a0a0f', fontWeight: '700' },
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a2e' },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00d4ff', marginRight: 8 },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText:     { color: '#00d4ff', fontWeight: '700' },
  rowTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle:       { color: '#aaa', fontSize: 15, flex: 1, marginRight: 8 },
  rowTitleUnread: { color: '#fff', fontWeight: '600' },
  rowTime:        { color: '#666', fontSize: 12 },
  rowPreview:     { color: '#666', fontSize: 13, marginTop: 2 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText:      { color: '#ff6b6b', marginBottom: 12 },
  retry:          { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#1a1a2e', borderRadius: 20 },
  retryText:      { color: '#00d4ff', fontWeight: '600' },
  emptyTitle:     { color: '#aaa', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBody:      { color: '#666', fontSize: 13, marginTop: 4 },
});
