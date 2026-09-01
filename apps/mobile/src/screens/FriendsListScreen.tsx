// apps/mobile/src/screens/FriendsListScreen.tsx
// Tabs: Friends · Following · Followers · Requests
// Entry: Profile → Friends card / openRootScreen('FriendsList')

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

import type { AccountStackParamList } from '@/navigation/stacks';
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

type Nav = NativeStackNavigationProp<AccountStackParamList & RootStackParamList>;

const TABS: { key: FriendsTab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
  { key: 'requests', label: 'Requests' },
];

export function FriendsListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { on } = useSocket();
  const [tab, setTab] = useState<FriendsTab>('friends');
  const list = useAppSelector((s) => s.friends[tab]);
  const pendingActionIds = useAppSelector((s) => s.friends.pendingActionIds);
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);

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
    const unsubPresence = on('friend:presence', (e) => {
      dispatch(friendOnlineChanged({ userId: e.userId, online: e.online }));
    });
    const unsubRequest = on('friend:request', (e) => {
      dispatch(pendingCountSet(e.pendingCount));
    });
    return () => {
      unsubPresence();
      unsubRequest();
    };
  }, [on, dispatch]);

  const onRefresh = useCallback(() => {
    load(tab);
    void dispatch(fetchPendingCount());
  }, [load, tab, dispatch]);

  const onEndReached = useCallback(() => {
    if (list.nextCursor && !list.loadingMore && !list.loading) {
      void dispatch(fetchFriendsTab({ tab, cursor: list.nextCursor }));
    }
  }, [dispatch, list.nextCursor, list.loadingMore, list.loading, tab]);

  const openProfile = useCallback(
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
      void dispatch(acceptFriendRequest(id)).then((r) => {
        if (acceptFriendRequest.fulfilled.match(r)) {
          void dispatch(fetchFriendsTab({ tab: 'friends' }));
        } else {
          appAlert('Could not accept', (r.payload as string) ?? 'Try again.');
        }
      });
    },
    [dispatch],
  );

  const onDecline = useCallback(
    (id: string) => {
      void dispatch(declineFriendRequest(id)).then((r) => {
        if (!declineFriendRequest.fulfilled.match(r)) {
          appAlert('Could not decline', (r.payload as string) ?? 'Try again.');
        }
      });
    },
    [dispatch],
  );

  const onUnfriend = useCallback(
    (userId: string, name: string) => {
      appAlert('Unfriend', `Remove ${name} from your friends?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => {
            void dispatch(unfriendUser(userId)).then((r) => {
              if (!unfriendUser.fulfilled.match(r)) {
                appAlert('Could not unfriend', (r.payload as string) ?? 'Try again.');
              }
            });
          },
        },
      ]);
    },
    [dispatch],
  );

  const emptyCopy = useMemo(() => {
    switch (tab) {
      case 'friends':
        return {
          title: 'No close friends yet',
          hint: 'Send a friend request from someone’s profile. Accepted friends show here.',
          showSuggestions: true,
        };
      case 'following':
        return {
          title: 'Not following anyone',
          hint: 'Follow people from their profile to build your public graph.',
          showSuggestions: true,
        };
      case 'followers':
        return {
          title: 'No followers yet',
          hint: 'When others follow you, they’ll appear here.',
          showSuggestions: false,
        };
      case 'requests':
        return {
          title: 'No pending requests',
          hint: 'Incoming friend requests land here for you to accept or decline.',
          showSuggestions: false,
        };
    }
  }, [tab]);

  const renderFriend = useCallback(
    ({ item }: { item: FriendCard }) => {
      const busy = pendingActionIds.includes(item.userId);
      return (
        <TouchableOpacity
          style={S.row}
          onPress={() => openProfile(item.userId)}
          accessibilityRole="button"
        >
          <Avatar
            uri={item.avatarUrl}
            name={item.displayName}
            size={44}
            online={item.online === true}
          />
          <View style={S.rowBody}>
            <Text style={S.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            {item.online === true ? (
              <Text style={S.metaOnline}>Online</Text>
            ) : item.online === false ? (
              <Text style={S.meta}>Offline</Text>
            ) : null}
          </View>
          {tab === 'friends' ? (
            <TouchableOpacity
              style={[S.secondaryBtn, busy && S.btnDisabled]}
              disabled={busy}
              onPress={() => onUnfriend(item.userId, item.displayName)}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={S.secondaryBtnText}>Unfriend</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      );
    },
    [openProfile, onUnfriend, pendingActionIds, tab],
  );

  const renderRequest = useCallback(
    ({ item }: { item: FriendRequestCard }) => {
      const busy = pendingActionIds.includes(item.id);
      return (
        <View style={S.row}>
          <TouchableOpacity onPress={() => openProfile(item.fromUserId)}>
            <Avatar uri={item.avatarUrl} name={item.displayName} size={44} />
          </TouchableOpacity>
          <TouchableOpacity style={S.rowBody} onPress={() => openProfile(item.fromUserId)}>
            <Text style={S.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={S.meta}>Wants to be friends</Text>
          </TouchableOpacity>
          <View style={S.requestActions}>
            <TouchableOpacity
              style={[S.acceptBtn, busy && S.btnDisabled]}
              disabled={busy}
              onPress={() => onAccept(item.id)}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={S.acceptBtnText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.secondaryBtn, busy && S.btnDisabled]}
              disabled={busy}
              onPress={() => onDecline(item.id)}
            >
              <Text style={S.secondaryBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [openProfile, onAccept, onDecline, pendingActionIds],
  );

  const data = list.items;

  return (
    <View style={S.root}>
      <View style={S.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={S.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.heading}>Friends</Text>
        <TouchableOpacity onPress={openSuggestions} hitSlop={8} accessibilityRole="button">
          <Text style={S.suggestLink}>Suggest</Text>
        </TouchableOpacity>
      </View>

      <View style={S.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[S.tab, active && S.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <View style={S.tabInner}>
                <Text style={[S.tabText, active && S.tabTextActive]}>{t.label}</Text>
                {t.key === 'requests' && pendingCount > 0 ? (
                  <View style={S.tabBadge}>
                    <Text style={S.tabBadgeText}>
                      {pendingCount > 99 ? '99+' : String(pendingCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {list.loading && data.length === 0 ? (
        <View style={S.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : list.error && data.length === 0 ? (
        <View style={S.center}>
          <Text style={S.errorText}>{list.error}</Text>
          <TouchableOpacity style={S.retry} onPress={onRefresh}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data as (FriendCard | FriendRequestCard)[]}
          keyExtractor={(item) =>
            tab === 'requests'
              ? (item as FriendRequestCard).id
              : (item as FriendCard).userId
          }
          contentContainerStyle={S.listContent}
          refreshControl={
            <RefreshControl
              refreshing={list.loading && data.length > 0}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={S.emptyHint}>{emptyCopy.hint}</Text>
              {emptyCopy.showSuggestions ? (
                <TouchableOpacity style={S.suggestCta} onPress={openSuggestions}>
                  <Text style={S.suggestCtaText}>See suggestions</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          ListFooterComponent={
            list.loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={({ item }) =>
            tab === 'requests'
              ? renderRequest({ item: item as FriendRequestCard })
              : renderFriend({ item: item as FriendCard })
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBar: {
    paddingTop: 52,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: colors.primary, fontSize: 17, fontWeight: '600', width: 64 },
  heading: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  suggestLink: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    width: 64,
    textAlign: 'right',
  },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 6,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: colors.onPrimary, fontWeight: '700' },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },

  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 40, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  metaOnline: { color: colors.success, fontSize: fontSize.xs, marginTop: 2, fontWeight: '600' },

  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  acceptBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  suggestCta: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  suggestCtaText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  errorText: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
});
