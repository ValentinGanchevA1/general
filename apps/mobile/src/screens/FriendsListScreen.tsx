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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type {
  FriendCard,
  FriendRequestCard,
  FriendRequestDirection,
} from '@g88/shared';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VerificationBadge } from '@/components/VerificationBadge';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchPendingCount,
  fetchRequests,
  unfriend,
} from '@/features/friends/friendsSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import type { SocialStackParamList } from '@/navigation/stacks';
import { colors, spacing, radius, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<SocialStackParamList & RootStackParamList>;

type Tab = 'friends' | 'requests';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function FriendsListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { on } = useSocket();
  const friends = useAppSelector((s) => s.friends.friends);
  const requests = useAppSelector((s) => s.friends.requests);
  const friendsLoading = useAppSelector((s) => s.friends.friendsLoading);
  const requestsLoading = useAppSelector((s) => s.friends.requestsLoading);
  const friendsError = useAppSelector((s) => s.friends.friendsError);
  const requestsError = useAppSelector((s) => s.friends.requestsError);
  const friendsNextCursor = useAppSelector((s) => s.friends.friendsNextCursor);
  const requestsNextCursor = useAppSelector((s) => s.friends.requestsNextCursor);
  const friendsLoadingMore = useAppSelector((s) => s.friends.friendsLoadingMore);
  const requestsLoadingMore = useAppSelector((s) => s.friends.requestsLoadingMore);
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);

  const [tab, setTab] = useState<Tab>('friends');
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const loadFriends = useCallback(() => {
    void dispatch(fetchFriends({}));
  }, [dispatch]);

  const loadRequests = useCallback(() => {
    void dispatch(fetchRequests({}));
    void dispatch(fetchPendingCount());
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
      loadRequests();
    }, [loadFriends, loadRequests]),
  );

  useEffect(() => {
    const unsubs = [
      on('friend:request', () => {
        loadRequests();
      }),
      on('friend:accepted', () => {
        loadFriends();
        loadRequests();
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [on, loadFriends, loadRequests]);

  const data = tab === 'friends' ? friends : requests;
  const list =
    tab === 'friends'
      ? {
          loading: friendsLoading,
          error: friendsError,
          nextCursor: friendsNextCursor,
          loadingMore: friendsLoadingMore,
        }
      : {
          loading: requestsLoading,
          error: requestsError,
          nextCursor: requestsNextCursor,
          loadingMore: requestsLoadingMore,
        };

  const onRefresh = useCallback(() => {
    if (tab === 'friends') loadFriends();
    else loadRequests();
  }, [tab, loadFriends, loadRequests]);

  const onEndReached = useCallback(() => {
    if (!list.nextCursor || list.loadingMore) return;
    if (tab === 'friends') {
      void dispatch(fetchFriends({ cursor: list.nextCursor }));
    } else {
      void dispatch(fetchRequests({ cursor: list.nextCursor }));
    }
  }, [dispatch, tab, list.nextCursor, list.loadingMore]);

  const setBusy = useCallback((id: string, onFlag: boolean) => {
    setBusyIds((prev) => (onFlag ? [...prev, id] : prev.filter((x) => x !== id)));
  }, []);

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
    async (requestId: string) => {
      setBusy(requestId, true);
      try {
        await dispatch(acceptFriendRequest(requestId)).unwrap();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(requestId, false);
      }
    },
    [dispatch, setBusy],
  );

  const onDecline = useCallback(
    async (requestId: string) => {
      setBusy(requestId, true);
      try {
        await dispatch(declineFriendRequest(requestId)).unwrap();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(requestId, false);
      }
    },
    [dispatch, setBusy],
  );

  const onUnfriend = useCallback(
    async (userId: string) => {
      setBusy(userId, true);
      try {
        await dispatch(unfriend(userId)).unwrap();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(userId, false);
      }
    },
    [dispatch, setBusy],
  );

  const emptyCopy = useMemo(() => {
    if (tab === 'requests') {
      return {
        icon: 'account-clock-outline',
        title: 'No pending requests',
        hint: 'When someone sends you a friend request, it shows up here.',
        showSuggestions: false,
      };
    }
    return {
      icon: 'account-group-outline',
      title: 'No friends yet',
      hint: 'Find people nearby or from suggestions.',
      showSuggestions: true,
    };
  }, [tab]);

  const renderFriend = useCallback(
    ({ item }: { item: FriendCard }) => {
      const busy = busyIds.includes(item.userId);
      return (
        <TouchableOpacity
          style={S.row}
          onPress={() => openProfile(item.userId)}
          activeOpacity={0.7}
        >
          <Avatar uri={item.avatarUrl} name={item.displayName} size={48} />
          <View style={S.info}>
            <View style={S.nameRow}>
              <Text style={S.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              <VerificationBadge verification={item.verification ?? 'none'} size={14} />
            </View>
            {item.isOnline ? (
              <Text style={S.online}>Online</Text>
            ) : item.lastActiveAt ? (
              <Text style={S.meta}>Active {timeAgo(item.lastActiveAt)}</Text>
            ) : null}
          </View>
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
        </TouchableOpacity>
      );
    },
    [busyIds, openProfile, onUnfriend],
  );

  const renderRequest = useCallback(
    ({ item }: { item: FriendRequestCard }) => {
      const busy = busyIds.includes(item.id);
      const incoming = item.direction === ('incoming' as FriendRequestDirection);
      return (
        <TouchableOpacity
          style={S.row}
          onPress={() => openProfile(item.fromUser.id)}
          activeOpacity={0.7}
        >
          <Avatar uri={item.fromUser.avatarUrl} name={item.fromUser.displayName} size={48} />
          <View style={S.info}>
            <View style={S.nameRow}>
              <Text style={S.name} numberOfLines={1}>
                {item.fromUser.displayName}
              </Text>
              <VerificationBadge
                verification={item.fromUser.verification ?? 'none'}
                size={14}
              />
            </View>
            <Text style={S.meta}>
              {incoming ? 'Wants to be friends' : 'Request sent'} · {timeAgo(item.createdAt)}
            </Text>
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
    [busyIds, openProfile, onAccept, onDecline],
  );

  return (
    <View style={S.root}>
      <ScreenHeader
        title="Friends"
        right={
          <TouchableOpacity onPress={openSuggestions} hitSlop={8} accessibilityRole="button" accessibilityLabel="Suggestions">
            <Text style={S.headerAction}>Suggest</Text>
          </TouchableOpacity>
        }
        bordered
      />

      <View style={S.tabs}>
        <TouchableOpacity
          style={[S.tab, tab === 'friends' && S.tabActive]}
          onPress={() => setTab('friends')}
        >
          <Text style={[S.tabText, tab === 'friends' && S.tabTextActive]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.tab, tab === 'requests' && S.tabActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[S.tabText, tab === 'requests' && S.tabTextActive]}>Requests</Text>
          {pendingCount > 0 ? (
            <View style={S.badge}>
              <Text style={S.badgeText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
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
              {...(emptyCopy.showSuggestions
                ? { actionLabel: 'See suggestions', onAction: openSuggestions }
                : {})}
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
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md, maxWidth: 160 },
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
