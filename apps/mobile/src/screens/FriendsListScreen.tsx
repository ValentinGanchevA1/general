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
import { FriendsSuggestionsRail } from '@/features/friends/FriendsSuggestionsRail';
import { useSocket } from '@/realtime/useSocket';
import { Avatar } from '@/components/Avatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, fontSize, useAppTheme } from '@/theme';

type Nav = NativeStackNavigationProp<SocialStackParamList & RootStackParamList>;

const TABS: { key: FriendsTab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
  { key: 'requests', label: 'Requests' },
];

export function FriendsListScreen(): React.JSX.Element {
  const { colors: themeColors } = useAppTheme();

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
    (userId: string, name: string) => {
      appAlert('Unfriend', `Remove ${name} from friends?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => {
            void dispatch(unfriendUser(userId));
          },
        },
      ]);
    },
    [dispatch],
  );

  const renderFriend = useCallback(
    ({ item }: { item: FriendCard }) => (
      <TouchableOpacity
        style={S.row}
        onPress={() => openProfile(item.userId)}
        accessibilityRole="button"
        accessibilityLabel={item.displayName}
      >
        <Avatar uri={item.avatarUrl} name={item.displayName} size={44} />
        <View style={S.rowBody}>
          <Text style={S.name} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.online ? <Text style={S.online}>Online</Text> : null}
        </View>
        {tab === 'friends' ? (
          <TouchableOpacity
            onPress={() => onUnfriend(item.userId, item.displayName)}
            hitSlop={8}
            disabled={isBusy(item.userId)}
          >
            <Text style={S.unfriend}>Unfriend</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    ),
    [openProfile, tab, onUnfriend, isBusy],
  );

  const renderRequest = useCallback(
    ({ item }: { item: FriendRequestCard }) => (
      <View style={S.row}>
        <TouchableOpacity onPress={() => openProfile(item.fromUserId)}>
          <Avatar uri={item.avatarUrl} name={item.displayName} size={44} />
        </TouchableOpacity>
        <View style={S.rowBody}>
          <Text style={S.name} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={S.hint}>Wants to be friends</Text>
        </View>
        <TouchableOpacity
          style={S.acceptBtn}
          onPress={() => void onAccept(item.id)}
          disabled={isBusy(item.id)}
        >
          <Text style={S.acceptText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={S.declineBtn}
          onPress={() => void onDecline(item.id)}
          disabled={isBusy(item.id)}
        >
          <Text style={S.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    ),
    [openProfile, onAccept, onDecline, isBusy],
  );

  const headerRail =
    tab === 'friends' ? (
      <FriendsSuggestionsRail
        onSeeAll={openSuggestions}
        onOpenProfile={openProfile}
      />
    ) : null;

  return (
    <View style={[S.root, { backgroundColor: themeColors.bg }]}>
      <ScreenHeader
        title="Friends"
        right={
          <TouchableOpacity
            onPress={openSuggestions}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Suggestions"
          >
            <Icon name="account-plus-outline" size={24} color={colors.primary} />
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
            <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>
              {t.label}
              {t.key === 'requests' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {list.loading && data.length === 0 ? (
        <View style={S.skel}>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </View>
      ) : (
        <FlatList
          data={data as never[]}
          keyExtractor={(item: { id?: string; userId?: string }) =>
            item.id ?? item.userId ?? ''
          }
          renderItem={
            tab === 'requests'
              ? (renderRequest as never)
              : (renderFriend as never)
          }
          ListHeaderComponent={headerRail}
          refreshControl={
            <RefreshControl
              refreshing={list.loading}
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
              actionLabel={emptyCopy.showSuggestions ? 'Suggestions' : undefined}
              onAction={emptyCopy.showSuggestions ? openSuggestions : undefined}
            />
          }
          ListFooterComponent={
            list.loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  skel: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md },
  online: { color: colors.action, fontSize: 12, marginTop: 2 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  unfriend: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  acceptBtn: {
    backgroundColor: colors.primary,
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
});
