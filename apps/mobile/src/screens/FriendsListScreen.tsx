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
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
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

  const data = list.items;
  const emptyCopy = useMemo(() => {
    switch (tab) {
      case 'requests':
        return {
          icon: 'account-clock-outline',
          title: 'No pending requests',
          hint: 'When someone sends you a friend request, it shows up here.',
          showSuggestions: false,
        };
      case 'following':
        return {
          icon: 'account-arrow-right-outline',
          title: 'Not following anyone',
          hint: 'Follow people to see them here.',
          showSuggestions: true,
        };
      case 'followers':
        return {
          icon: 'account-arrow-left-outline',
          title: 'No followers yet',
          hint: 'People who follow you appear here.',
          showSuggestions: false,
        };
      default:
        return {
          icon: 'account-group-outline',
          title: 'No friends yet',
          hint: 'Find people nearby or from suggestions.',
          showSuggestions: true,
        };
    }
  }, [tab]);

  const isBusy = useCallback(
    (id: string) => pendingActionIds.includes(id),
    [pendingActionIds],
  );

  const onAccept = useCallback(
    async (requestId: string) => {
      try {
        await dispatch(acceptFriendRequest(requestId)).unwrap();
      } catch {
        appAlert('Error', 'Could not accept request.');
      }
    },
    [dispatch],
  );

  const onDecline = useCallback(
    async (requestId: string) => {
      try {
        await dispatch(declineFriendRequest(requestId)).unwrap();
      } catch {
        appAlert('Error', 'Could not decline request.');
      }
    },
    [dispatch],
  );

  const onUnfriend = useCallback(
    async (userId: string) => {
      try {
        await dispatch(unfriendUser(userId)).unwrap();
      } catch {
        appAlert('Error', 'Could not unfriend.');
      }
    },
    [dispatch],
  );

  const renderFriend = useCallback(
    ({ item }: { item: FriendCard }) => {
      const busy = isBusy(item.userId);
      return (
        <TouchableOpacity style={S.row} onPress={() => openProfile(item.userId)} activeOpacity={0.7}>
          <Avatar uri={item.avatarUrl} name={item.displayName} size={48} />
          <View style={S.info}>
            <Text style={S.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            {item.isOnline ? (
              <Text style={S.online}>Online</Text>
            ) : null}
          </View>
          {tab === 'friends' ? (
            <TouchableOpacity
              style={S.secondaryBtn}
              disabled={busy}
              onPress={(e) => {
                e.stopPropagation?.();
                void onUnfriend(item.userId);
              }}
            >
              <Text style={S.secondaryBtnText}>Unfriend</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      );
    },
    [isBusy, openProfile, onUnfriend, tab],
  );

  const renderRequest = useCallback(
    ({ item }: { item: FriendRequestCard }) => {
      const busy = isBusy(item.id);
      const incoming = item.direction === 'incoming';
      return (
        <TouchableOpacity
          style={S.row}
          onPress={() => openProfile(item.fromUser.id)}
          activeOpacity={0.7}
        >
          <Avatar uri={item.fromUser.avatarUrl} name={item.fromUser.displayName} size={48} />
          <View style={S.info}>
            <Text style={S.name} numberOfLines={1}>
              {item.fromUser.displayName}
            </Text>
            <Text style={S.meta}>{incoming ? 'Wants to be friends' : 'Request sent'}</Text>
          </View>
          {incoming ? (
            <View style={S.actions}>
              <TouchableOpacity
                style={S.declineBtn}
                disabled={busy}
                onPress={(e) => {
                  e.stopPropagation?.();
                  void onDecline(item.id);
                }}
              >
                <Text style={S.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={S.primaryBtn}
                disabled={busy}
                onPress={(e) => {
                  e.stopPropagation?.();
                  void onAccept(item.id);
                }}
              >
                <Text style={S.primaryBtnText}>Accept</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.pendingBadge}>
              <Text style={S.pendingText}>Pending</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [isBusy, openProfile, onAccept, onDecline],
  );

  return (
    <View style={S.root}>
      <ScreenHeader
        title="Friends"
        right={
          <TouchableOpacity
            onPress={openSuggestions}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Suggestions"
          >
            <Text style={S.headerAction}>Suggest</Text>
          </TouchableOpacity>
        }
        bordered
      />

      <View style={S.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[S.tab, tab === t.key && S.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>{t.label}</Text>
            {t.key === 'requests' && pendingCount > 0 ? (
              <View style={S.badge}>
                <Text style={S.badgeText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {list.loading && data.length === 0 ? (
        <View style={S.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.error && data.length === 0 ? (
        <View style={S.center}>
          <Text style={S.error}>{list.error}</Text>
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
            <EmptyState
              variant="plain"
              icon={emptyCopy.icon}
              title={emptyCopy.title}
              body={emptyCopy.hint}
              actionLabel={emptyCopy.showSuggestions ? 'See suggestions' : undefined}
              onAction={emptyCopy.showSuggestions ? openSuggestions : undefined}
            />
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
  headerAction: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.textPrimary, fontSize: 10, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.sm },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
  listContent: { paddingVertical: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  info: { flex: 1, gap: 2 },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md, maxWidth: 180 },
  online: { color: colors.action, fontSize: fontSize.xs, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: fontSize.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.action,
  },
  primaryBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  declineBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#2a2a1a',
  },
  pendingText: { color: colors.warning, fontWeight: '700', fontSize: 12 },
});
