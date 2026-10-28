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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  type CreateConversationRequest,
  type CreateConversationResponse,
  type FriendCard,
  type FriendListMetaItem,
  type FriendListMetaResponse,
  type FriendRequestCard,
} from '@g88/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { getJson, postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonListRow } from '@/components/Skeleton';
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
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import type { SocialStackParamList } from '@/navigation/stacks';
import { useSocket } from '@/realtime/useSocket';
import { fontSize, radius, spacing, type ThemeColors, useAppTheme } from '@/theme';
import { appAlert, type AppAlertButton } from '@/ui/appAlert';
import { extractMessage } from '@/utils/extractMessage';

type Nav = NativeStackNavigationProp<SocialStackParamList & RootStackParamList>;

type ListItem = FriendCard | FriendRequestCard;

const TABS: { key: FriendsTab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
  { key: 'requests', label: 'Requests' },
];

function formatDistance(distanceMeters: number | null | undefined): string | null {
  if (distanceMeters == null) return null;
  if (distanceMeters < 1_000) return '< 1 km away';
  return `${Math.max(1, Math.round(distanceMeters / 1_000))} km away`;
}

function formatMutualFriends(count: number | undefined): string {
  const value = count ?? 0;
  return `${value} mutual friend${value === 1 ? '' : 's'}`;
}

function rowMetaText(meta: FriendListMetaItem | undefined): string {
  const distance = formatDistance(meta?.distanceMeters);
  const mutual = formatMutualFriends(meta?.mutualFriendsCount);
  return distance ? `${distance} · ${mutual}` : mutual;
}

export function FriendsListScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const S = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { on } = useSocket();
  const [tab, setTab] = useState<FriendsTab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [metaByUserId, setMetaByUserId] = useState<Record<string, FriendListMetaItem>>({});
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
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
    const unsubPresence = on('friend:presence', (e) =>
      dispatch(friendOnlineChanged({ userId: e.userId, online: e.online })),
    );
    const unsubRequest = on('friend:request', (e) => dispatch(pendingCountSet(e.pendingCount)));
    return () => {
      unsubPresence();
      unsubRequest();
    };
  }, [on, dispatch]);

  const data = list.items as ListItem[];
  const metadataIdsKey = useMemo(() => {
    if (tab === 'requests') return '';
    return (data as FriendCard[]).map((item) => item.userId).join(',');
  }, [data, tab]);

  useEffect(() => {
    if (!metadataIdsKey) return;
    let active = true;
    void getJson<FriendListMetaResponse>(
      `/friends/list-meta?userIds=${encodeURIComponent(metadataIdsKey)}`,
    )
      .then((response) => {
        if (!active) return;
        const next: Record<string, FriendListMetaItem> = {};
        for (const item of response.items) next[item.userId] = item;
        setMetaByUserId((current) => ({ ...current, ...next }));
      })
      .catch(() => {
        // Metadata is progressive enhancement; the list remains usable without it.
      });
    return () => {
      active = false;
    };
  }, [metadataIdsKey]);

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return data;
    return data.filter((item) => item.displayName.toLocaleLowerCase().includes(query));
  }, [data, searchQuery]);

  const onRefresh = useCallback(() => {
    load(tab);
    void dispatch(fetchPendingCount());
  }, [load, tab, dispatch]);

  const onEndReached = useCallback(() => {
    if (searchQuery.trim()) return;
    if (list.nextCursor && !list.loadingMore && !list.loading) {
      void dispatch(fetchFriendsTab({ tab, cursor: list.nextCursor }));
    }
  }, [dispatch, list.nextCursor, list.loadingMore, list.loading, searchQuery, tab]);

  const openProfile = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  );
  const openSuggestions = useCallback(() => navigation.navigate('Suggestions'), [navigation]);

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

  const isBusy = useCallback((id: string) => pendingActionIds.includes(id), [pendingActionIds]);

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

  const confirmUnfriend = useCallback(
    (item: FriendCard): void => {
      appAlert(
        `Unfriend ${item.displayName}?`,
        'They will be removed from your Friends list. Following stays unchanged.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unfriend',
            style: 'destructive',
            onPress: () => void onUnfriend(item.userId),
          },
        ],
      );
    },
    [onUnfriend],
  );

  const openMessage = useCallback(
    async (item: FriendCard): Promise<void> => {
      if (messagingUserId != null) return;
      setMessagingUserId(item.userId);
      try {
        const response = await postJson<CreateConversationRequest, CreateConversationResponse>(
          '/conversations',
          { targetUserId: item.userId },
        );
        navigation.navigate('Chat', {
          conversationId: response.conversationId,
          otherUserName: item.displayName,
          requestPending: response.status === 'pending' && response.permission === 'request',
          otherUserId: item.userId,
        });
      } catch (error) {
        appAlert('Could not open chat', extractMessage(error, 'Try again in a moment.'));
      } finally {
        setMessagingUserId(null);
      }
    },
    [messagingUserId, navigation],
  );

  const openRowMenu = useCallback(
    (item: FriendCard): void => {
      const buttons: AppAlertButton[] = [
        { text: 'View profile', onPress: () => openProfile(item.userId) },
      ];
      if (tab === 'friends') {
        buttons.push({
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => confirmUnfriend(item),
        });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      appAlert(item.displayName, undefined, buttons);
    },
    [confirmUnfriend, openProfile, tab],
  );

  const renderFriend = useCallback(
    ({ item }: { item: FriendCard }) => {
      const messageBusy = messagingUserId === item.userId;
      return (
        <TouchableOpacity
          style={S.row}
          onPress={() => openProfile(item.userId)}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`Open profile for ${item.displayName}`}
        >
          <Avatar uri={item.avatarUrl} name={item.displayName} size={54} />
          <View style={S.info}>
            <View style={S.nameLine}>
              <Text style={S.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              {item.online === true ? <View style={S.onlineDot} accessibilityLabel="Online" /> : null}
            </View>
            <Text style={S.meta} numberOfLines={1}>
              {rowMetaText(metaByUserId[item.userId])}
            </Text>
          </View>
          <View style={S.rowActions}>
            <TouchableOpacity
              style={[S.iconButton, messageBusy && S.iconButtonDisabled]}
              disabled={messageBusy}
              onPress={(event) => {
                event.stopPropagation?.();
                void openMessage(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Message ${item.displayName}`}
            >
              {messageBusy ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <Icon name="message-outline" size={25} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={S.iconButton}
              onPress={(event) => {
                event.stopPropagation?.();
                openRowMenu(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={`More actions for ${item.displayName}`}
            >
              <Icon name="dots-horizontal" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [S, colors.textPrimary, messagingUserId, metaByUserId, openMessage, openProfile, openRowMenu],
  );

  const renderRequest = useCallback(
    ({ item }: { item: FriendRequestCard }) => {
      const busy = isBusy(item.id);
      return (
        <TouchableOpacity
          style={S.row}
          onPress={() => openProfile(item.fromUserId)}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`Open profile for ${item.displayName}`}
        >
          <Avatar uri={item.avatarUrl} name={item.displayName} size={54} />
          <View style={S.info}>
            <Text style={S.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={S.meta}>Wants to be friends</Text>
          </View>
          <View style={S.actions}>
            <TouchableOpacity
              style={S.declineBtn}
              disabled={busy}
              onPress={(event) => {
                event.stopPropagation?.();
                void onDecline(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Decline friend request from ${item.displayName}`}
            >
              <Text style={S.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={S.primaryBtn}
              disabled={busy}
              onPress={(event) => {
                event.stopPropagation?.();
                void onAccept(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Accept friend request from ${item.displayName}`}
            >
              <Text style={S.primaryBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [S, isBusy, onAccept, onDecline, openProfile],
  );

  const listFooter = useMemo(() => {
    return (
      <View>
        {list.loadingMore ? (
          <ActivityIndicator color={colors.primary} style={S.loadingMore} />
        ) : null}
        {tab === 'friends' && !searchQuery.trim() ? (
          <TouchableOpacity
            style={S.findMoreRow}
            onPress={openSuggestions}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Find more friends"
          >
            <View style={S.findMoreIcon}>
              <Icon name="account-plus-outline" size={26} color={colors.primary} />
            </View>
            <View style={S.findMoreCopy}>
              <Text style={S.findMoreTitle}>Find More Friends</Text>
              <Text style={S.findMoreSubtitle}>Connect with people near you</Text>
            </View>
            <Icon name="chevron-right" size={28} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [S, colors.primary, colors.textMuted, list.loadingMore, openSuggestions, searchQuery, tab]);

  const showSearchEmpty = searchQuery.trim().length > 0 && filteredData.length === 0;

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
            <Icon name="account-plus-outline" size={25} color={colors.primary} />
          </TouchableOpacity>
        }
        bordered
      />
      <View style={S.tabs}>
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[S.tab, tab === item.key && S.tabActive]}
            onPress={() => {
              setTab(item.key);
              setSearchQuery('');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            accessibilityLabel={
              item.key === 'requests' && pendingCount > 0
                ? `${item.label}, ${pendingCount} pending`
                : item.label
            }
          >
            <Text style={[S.tabText, tab === item.key && S.tabTextActive]}>{item.label}</Text>
            {item.key === 'requests' && pendingCount > 0 ? (
              <View style={S.badge}>
                <Text style={S.badgeText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <View style={S.searchContainer}>
        <Icon name="magnify" size={21} color={colors.textMuted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={tab === 'requests' ? 'Search requests...' : 'Search friends...'}
          placeholderTextColor={colors.textMuted}
          style={S.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search friends"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close-circle" size={19} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {list.loading && data.length === 0 ? (
        <View style={S.listContent}>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </View>
      ) : list.error && data.length === 0 ? (
        <View style={S.center}>
          <Text style={S.error}>{list.error}</Text>
          <TouchableOpacity
            style={S.retry}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Retry loading friends"
          >
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) =>
            tab === 'requests'
              ? (item as FriendRequestCard).id
              : (item as FriendCard).userId
          }
          contentContainerStyle={S.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={list.loading && data.length > 0}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            showSearchEmpty ? (
              <EmptyState
                variant="plain"
                icon="account-search-outline"
                title="No matches"
                body={`No people match “${searchQuery.trim()}”.`}
              />
            ) : (
              <EmptyState
                variant="plain"
                icon={emptyCopy.icon}
                title={emptyCopy.title}
                body={emptyCopy.hint}
                actionLabel={emptyCopy.showSuggestions ? 'See suggestions' : undefined}
                onAction={emptyCopy.showSuggestions ? openSuggestions : undefined}
              />
            )
          }
          ListFooterComponent={listFooter}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
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
      backgroundColor: colors.dangerSolid,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    searchInput: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 0,
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    error: { color: colors.danger, fontSize: fontSize.sm },
    retry: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
    },
    retryText: { color: colors.primary, fontWeight: '700' },
    listContent: { paddingBottom: spacing.xl, flexGrow: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 11,
      minHeight: 76,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    info: { flex: 1, minWidth: 0, gap: 4 },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    name: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: fontSize.md,
      flexShrink: 1,
    },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.action },
    meta: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '500' },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonDisabled: { opacity: 0.55 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.action,
    },
    primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
    declineBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    declineBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    loadingMore: { marginVertical: spacing.md },
    findMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    findMoreIcon: {
      width: 50,
      height: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    findMoreCopy: { flex: 1, gap: 2 },
    findMoreTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
    findMoreSubtitle: { color: colors.textMuted, fontSize: fontSize.xs },
  });
}
