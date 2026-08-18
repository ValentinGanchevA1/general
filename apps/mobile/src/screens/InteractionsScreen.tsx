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

import type { FollowRequest, InboxItem, WaveRequest, WaveResponse } from '@g88/shared';

import { postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { VerificationBadge } from '@/components/VerificationBadge';
import {
  acceptFriendRequest,
  declineFriendRequest,
} from '@/features/friends/friendsSlice';
import { useInboxInteractions } from '@/features/interactions/useInboxInteractions';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch } from '@/store/hooks';

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

function signalLabel(item: InboxItem): string {
  if (item.type === 'wave') return 'waved at you';
  if (item.type === 'friend_request') return 'sent you a friend request';
  if (item.type === 'follow') return 'started following you';
  if (item.reactionKind === 'heart') return '❤️ reacted to your story';
  if (item.reactionKind === 'wave') return '👋 reacted to your story';
  return 'reacted to your story';
}

function Row({
  item,
  busy,
  onMatch,
  onAccept,
  onDecline,
  onFollowBack,
  onOpenProfile,
}: {
  item: InboxItem;
  busy: boolean;
  onMatch: (userId: string) => void;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onFollowBack: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpenProfile(item.fromUser.id)}
      activeOpacity={0.7}
    >
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

      {item.type === 'wave' &&
        (item.isMutual ? (
          <View style={styles.mutualBadge}>
            <Text style={styles.mutualText}>Match</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onMatch(item.fromUser.id);
            }}
          >
            <Text style={styles.primaryBtnText}>Match</Text>
          </TouchableOpacity>
        ))}

      {item.type === 'friend_request' && item.requestId && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onDecline(item.requestId!);
            }}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onAccept(item.requestId!);
            }}
          >
            <Text style={styles.primaryBtnText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.type === 'follow' &&
        (item.isFollowingBack ? (
          <View style={styles.mutualBadge}>
            <Text style={styles.mutualText}>Following</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onFollowBack(item.fromUser.id);
            }}
          >
            <Text style={styles.primaryBtnText}>Follow back</Text>
          </TouchableOpacity>
        ))}
    </TouchableOpacity>
  );
}

export function InteractionsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { items, loading, refresh } = useInboxInteractions();
  const { markSeen } = useReceivedInteractions();
  const [busyIds, setBusyIds] = React.useState<string[]>([]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      markSeen();
    });
  }, [markSeen]);

  const setBusy = useCallback((id: string, on: boolean) => {
    setBusyIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }, []);

  const onMatch = useCallback(
    async (userId: string): Promise<void> => {
      setBusy(userId, true);
      try {
        await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
          toUserId: userId,
          context: 'profile',
        });
        await refresh();
      } catch {
        // global error path
      } finally {
        setBusy(userId, false);
      }
    },
    [refresh, setBusy],
  );

  const onAccept = useCallback(
    async (requestId: string): Promise<void> => {
      setBusy(requestId, true);
      try {
        await dispatch(acceptFriendRequest(requestId)).unwrap();
        await refresh();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(requestId, false);
      }
    },
    [dispatch, refresh, setBusy],
  );

  const onDecline = useCallback(
    async (requestId: string): Promise<void> => {
      setBusy(requestId, true);
      try {
        await dispatch(declineFriendRequest(requestId)).unwrap();
        await refresh();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(requestId, false);
      }
    },
    [dispatch, refresh, setBusy],
  );

  const onFollowBack = useCallback(
    async (userId: string): Promise<void> => {
      setBusy(userId, true);
      try {
        await postJson<FollowRequest, { following: true }>('/friends/follow', {
          userId,
        });
        await refresh();
      } catch {
        // global error path
      } finally {
        setBusy(userId, false);
      }
    },
    [refresh, setBusy],
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
              Waves, friend requests, and new followers show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Row
            item={item}
            busy={busyIds.includes(item.requestId ?? item.fromUser.id)}
            onMatch={(id) => void onMatch(id)}
            onAccept={(id) => void onAccept(id)}
            onDecline={(id) => void onDecline(id)}
            onFollowBack={(id) => void onFollowBack(id)}
            onOpenProfile={onOpenProfile}
          />
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
  name: { color: '#fff', fontWeight: '600', fontSize: 15, maxWidth: 160 },
  signal: { color: '#aaa', fontSize: 13 },
  time: { color: '#666', fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1dbf73',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  declineBtnText: { color: '#aaa', fontWeight: '600', fontSize: 13 },
  mutualBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1a3a2a',
  },
  mutualText: { color: '#34e0a1', fontWeight: '700', fontSize: 12 },
});
