// apps/mobile/src/screens/FriendsListScreen.tsx
// Tabs: Friends · Following · Followers · Requests
// Entry: Profile → Friends card / openRootScreen('FriendsList') → Social stack

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { FriendCard, FriendRequestCard } from '@g88/shared';

import type { SocialStackParamList } from '@/navigation/stacks';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendsTab,
  fetchPendingCount,
  friendOnlineChanged,
  pendingCountSet,
  type FriendsTab,
  unfriendUser,
} from '@/features/friends/friendsSlice';
import { useSocket } from '@/realtime/useSocket';
import { Avatar } from '@/components/Avatar';
import { colors, spacing, radius, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<SocialStackParamList & RootStackParamList>;

const TABS: { key: FriendsTab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
  { key: 'requests', label: 'Requests' },
];

export function FriendsListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<FriendsTab>('friends');
  const [refreshing, setRefreshing] = useState(false);
  const list = useAppSelector((s) => s.friends.lists[tab]);
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);
  const { on } = useSocket();

  const load = useCallback(
    (t: FriendsTab = tab) => {
      void dispatch(fetchFriendsTab({ tab: t }));
    },
    [dispatch, tab],
  );

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    void dispatch(fetchPendingCount());
  }, [dispatch]);

  useEffect(() => {
    const unsub = on('friend:online', (payload: { userId: string; online: boolean }) => {
      dispatch(friendOnlineChanged(payload));
    });
    return unsub;
  }, [on, dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchFriendsTab({ tab }));
      if (tab === 'requests') await dispatch(fetchPendingCount());
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, tab]);

  const onEndReached = useCallback(() => {
    if (list.status === 'loading' || !list.nextCursor) return;
    void dispatch(fetchFriendsTab({ tab, cursor: list.nextCursor }));
  }, [dispatch, list.nextCursor, list.status, tab]);

  const openUser = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  const openSuggestions = useCallback(() => {
    navigation.navigate('Suggestions');
  }, [navigation]);

  const onAccept = useCallback(
    (id: string) => {
      void dispatch(acceptFriendRequest({ requestId: id })).then(() => {
        void dispatch(fetchFriendsTab({ tab: 'friends' }));
        void dispatch(fetchPendingCount());
      });
    },
    [dispatch],
  );

  const onDecline = useCallback(
    (id: string) => {
      void dispatch(declineFriendRequest({ requestId: id })).then(() => {
        void dispatch(fetchPendingCount());
      });
    },
    [dispatch],
  );

  const onUnfriend = useCallback(
    (userId: string, name: string) => {
      appAlert('Remove friend?', `Unfriend ${name}? You can still follow each other.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => {
            void dispatch(unfriendUser({ userId }));
          },
        },
      ]);
    },
    [dispatch],
  );

  const data = list.items;
  const showSuggestions = tab === 'friends';

  return (
    <View style={S.root}>
      <View style={S.header}>
        <Text style={S.heading}>Friends</Text>
        {showSuggestions ? (
          <TouchableOpacity onPress={openSuggestions} accessibilityRole="button">
            <Text style={S.suggestLink}>Suggestions</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={S.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = t.key === 'requests' && pendingCount > 0 ? pendingCount : 0;
          return (
            <TouchableOpacity
              key={t.key}
              style={[S.tab, active && S.tabActive]}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[S.tabText, active && S.tabTextActive]}>
                {t.label}
                {badge > 0 ? ` (${badge > 9 ? '9+' : badge})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {list.status === 'loading' && data.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={data as Array<FriendCard | FriendRequestCard>}
          keyExtractor={(item) => ('id' in item && typeof (item as FriendRequestCard).id === 'string' && 'fromUserId' in item ? (item as FriendRequestCard).id : (item as FriendCard).userId)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={S.listContent}
          ListEmptyComponent={
            <Text style={S.empty}>
              {tab === 'requests' ? 'No pending requests' : 'Nothing here yet'}
            </Text>
          }
          renderItem={({ item }) => {
            if ('fromUserId' in item) {
              const req = item as FriendRequestCard;
              return (
                <View style={S.row}>
                  <TouchableOpacity style={S.rowMain} onPress={() => openUser(req.fromUserId)}>
                    <Avatar uri={req.avatarUrl} name={req.displayName} size={44} />
                    <Text style={S.name} numberOfLines={1}>
                      {req.displayName}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.acceptBtn} onPress={() => onAccept(req.id)}>
                    <Text style={S.acceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.declineBtn} onPress={() => onDecline(req.id)}>
                    <Text style={S.declineText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            const friend = item as FriendCard;
            return (
              <TouchableOpacity style={S.row} onPress={() => openUser(friend.userId)}>
                <Avatar
                  uri={friend.avatarUrl}
                  name={friend.displayName}
                  size={44}
                  online={friend.online === true}
                />
                <View style={S.rowText}>
                  <Text style={S.name} numberOfLines={1}>
                    {friend.displayName}
                  </Text>
                  {friend.online === true ? (
                    <Text style={S.online}>Online</Text>
                  ) : friend.online === false ? (
                    <Text style={S.offline}>Offline</Text>
                  ) : null}
                </View>
                {tab === 'friends' ? (
                  <TouchableOpacity
                    onPress={() => onUnfriend(friend.userId, friend.displayName)}
                    hitSlop={8}
                  >
                    <Text style={S.unfriend}>Unfriend</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  suggestLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 6,
    marginBottom: spacing.sm,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.onPrimary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  online: { color: colors.success, fontSize: 12, marginTop: 2 },
  offline: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  acceptBtn: {
    backgroundColor: colors.action,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  acceptText: { color: colors.onPrimary, fontWeight: '700', fontSize: 12 },
  declineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  declineText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  unfriend: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
