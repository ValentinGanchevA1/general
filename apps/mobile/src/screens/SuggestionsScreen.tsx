import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ApiError, SuggestionCard, SuggestionReason } from '@g88/shared';

import type { SocialStackParamList } from '@/navigation/stacks';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson, postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import { colors, spacing, radius, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<SocialStackParamList & RootStackParamList>;

function reasonLabel(reason: SuggestionReason, mutual: number): string {
  switch (reason) {
    case 'mutual_friends':
      return mutual === 1 ? '1 mutual friend' : `${mutual} mutual friends`;
    case 'recent_wave':
      return 'Recent wave';
    case 'recent_chat':
      return 'Recent chat';
  }
}

function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
  );
}

export function SuggestionsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<SuggestionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<SuggestionCard[]>('/friends/suggestions?limit=20');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'Could not load suggestions.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openProfile = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  const setBusy = useCallback((userId: string, on: boolean) => {
    setBusyIds((prev) =>
      on ? (prev.includes(userId) ? prev : [...prev, userId]) : prev.filter((id) => id !== userId),
    );
  }, []);

  const markFollowing = useCallback((userId: string) => {
    setItems((prev) =>
      prev.map((c) => (c.userId === userId ? { ...c, isFollowing: true } : c)),
    );
  }, []);

  const markRequested = useCallback((userId: string) => {
    setItems((prev) =>
      prev.map((c) =>
        c.userId === userId ? { ...c, hasPendingOutgoing: true } : c,
      ),
    );
  }, []);

  const removeCard = useCallback((userId: string) => {
    setItems((prev) => prev.filter((c) => c.userId !== userId));
  }, []);

  const onFollow = useCallback(
    async (userId: string) => {
      setBusy(userId, true);
      try {
        await postJson<{ userId: string }, { following: true }>('/friends/follow', { userId });
        markFollowing(userId);
      } catch (e) {
        const msg = isApiError(e) ? e.message : 'Try again.';
        appAlert('Could not follow', msg);
      } finally {
        setBusy(userId, false);
      }
    },
    [markFollowing, setBusy],
  );

  const onAddFriend = useCallback(
    async (userId: string) => {
      setBusy(userId, true);
      try {
        await postJson<{ userId: string }, { requestId: string }>('/friends/requests', {
          userId,
        });
        markRequested(userId);
      } catch (e) {
        if (isApiError(e)) {
          if (e.code === 'friends.request_pending') {
            markRequested(userId);
            return;
          }
          if (e.code === 'friends.already_friends') {
            removeCard(userId);
            return;
          }
          appAlert('Could not send request', e.message || 'Try again.');
          return;
        }
        appAlert('Could not send request', 'Try again.');
      } finally {
        setBusy(userId, false);
      }
    },
    [markRequested, removeCard, setBusy],
  );

  const renderItem = useCallback(
    ({ item }: { item: SuggestionCard }) => {
      const busy = busyIds.includes(item.userId);
      return (
        <View style={S.card}>
          <TouchableOpacity
            style={S.cardMain}
            onPress={() => openProfile(item.userId)}
            accessibilityRole="button"
            accessibilityLabel={`Open profile for ${item.displayName}`}
          >
            <Avatar uri={item.avatarUrl} name={item.displayName} size={48} />
            <View style={S.cardMeta}>
              <Text style={S.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              {item.reason === 'mutual_friends' && item.mutualFriendsCount > 0 ? (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('MutualFriends', {
                      peerUserId: item.userId,
                      peerName: item.displayName,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={reasonLabel(item.reason, item.mutualFriendsCount)}
                  hitSlop={6}
                >
                  <Text style={[S.reason, S.reasonLink]}>
                    {reasonLabel(item.reason, item.mutualFriendsCount)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={S.reason}>
                  {reasonLabel(item.reason, item.mutualFriendsCount)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={S.actions}>
            {!item.isFollowing ? (
              <TouchableOpacity
                style={S.btnSecondary}
                onPress={() => void onFollow(item.userId)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Follow ${item.displayName}`}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={S.btnSecondaryText}>Follow</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={S.btnGhost}>
                <Text style={S.btnGhostText}>Following</Text>
              </View>
            )}
            {!item.hasPendingOutgoing ? (
              <TouchableOpacity
                style={S.btnPrimary}
                onPress={() => void onAddFriend(item.userId)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.displayName} as friend`}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={S.btnPrimaryText}>Add</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={S.btnGhost}>
                <Text style={S.btnGhostText}>Requested</Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [busyIds, navigation, onAddFriend, onFollow, openProfile],
  );

  return (
    <View style={S.root}>
      <ScreenHeader title="Suggestions" />

      {loading && items.length === 0 ? (
        <View style={S.list}>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </View>
      ) : error && items.length === 0 ? (
        <View style={S.centered}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity style={S.retry} onPress={() => void load()}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.userId}
          renderItem={renderItem}
          contentContainerStyle={S.list}
          refreshControl={
            <RefreshControl
              refreshing={loading && items.length > 0}
              onRefresh={() => void load()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              variant="plain"
              icon="account-plus-outline"
              title="No suggestions yet"
              body="Wave at people on the map, chat, or grow your friend graph — suggestions show up here."
            />
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  list: { paddingBottom: 40, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  cardMeta: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md },
  reason: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  reasonLink: { color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  btnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.action,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  btnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
});
