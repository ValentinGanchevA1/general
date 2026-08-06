import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ReceivedInteraction, WaveRequest, WaveResponse } from '@g88/shared';

import { postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { VerificationBadge } from '@/components/VerificationBadge';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function signalLabel(item: ReceivedInteraction): string {
  if (item.type === 'wave') return 'waved at you';
  if (item.reactionKind === 'heart') return '❤️ reacted to your story';
  if (item.reactionKind === 'wave') return '👋 reacted to your story';
  return 'reacted to your story';
}

function Row({
  item,
  onWaveBack,
  onOpenProfile,
}: {
  item: ReceivedInteraction;
  onWaveBack: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onOpenProfile(item.fromUser.id)} activeOpacity={0.7}>
      <Avatar uri={item.fromUser.avatarUrl} name={item.fromUser.displayName} size={48} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.fromUser.displayName}
          </Text>
          <VerificationBadge verification={item.fromUser.verification} size={14} />
        </View>
        <Text style={styles.signal}>{signalLabel(item)}</Text>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      {item.isMutual ? (
        <View style={styles.mutualBadge}>
          <Text style={styles.mutualText}>Match</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.waveBackBtn}
          onPress={() => onWaveBack(item.fromUser.id)}
        >
          <Text style={styles.waveBackText}>👋</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function InteractionsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { items, loading, refresh, markSeen } = useReceivedInteractions();

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  const onWaveBack = useCallback(
    async (userId: string): Promise<void> => {
      try {
        await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
          toUserId: userId,
          context: 'profile',
        });
        await refresh();
      } catch {
        // toast handled by global error path if any
      }
    },
    [refresh],
  );

  const onOpenProfile = useCallback(
    (userId: string): void => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00d4ff" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor="#00d4ff" />
        }
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No interactions yet</Text>
            <Text style={styles.emptyBody}>
              When someone waves at you or reacts to your story, they show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Row item={item} onWaveBack={(id) => void onWaveBack(id)} onOpenProfile={onOpenProfile} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a1a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a1a' },
  list: { paddingVertical: 8 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { paddingHorizontal: 32, alignItems: 'center' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a2e',
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#fff', fontWeight: '600', fontSize: 15, maxWidth: 180 },
  signal: { color: '#aaa', fontSize: 13 },
  time: { color: '#666', fontSize: 12 },
  waveBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00d4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveBackText: { fontSize: 20 },
  mutualBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1a3a2a',
  },
  mutualText: { color: '#34e0a1', fontWeight: '700', fontSize: 12 },
});
