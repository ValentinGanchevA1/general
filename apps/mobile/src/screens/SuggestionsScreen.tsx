import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ApiError, SuggestionCard, SuggestionReason } from '@g88/shared';

import type { AccountStackParamList } from '@/navigation/stacks';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson, postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { colors, spacing, radius, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList & RootStackParamList>;

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

  // Reload when returning from Profile so Follow/Requested match server graph.
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

  /** Pending either way or already friends → drop from suggestions (matches backend exclude). */
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
        Alert.alert('Could not follow', msg);
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
        // Idempotent conflicts: request already lives on server (e.g. sent from Profile).
        if (isApiError(e)) {
          if (e.code === 'friends.request_pending') {
            markRequested(userId);
            return;
          }
          if (e.code === 'friends.already_friends') {
            removeCard(userId);
            return;
          }
          Alert.alert('Could not send request', e.message || 'Try again.');
          return;
        }
        Alert.alert('Could not send request', 'Try again.');
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
          >
            <Avatar uri={item.avatarUrl} name={item.displayName} size={48} />
            <View style={S.cardMeta}>
              <Text style={S.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              <Text style={S.reason}>
                {reasonLabel(item.reason, item.mutualFriendsCount)}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={S.actions}>
            {!item.isFollowing ? (
              <TouchableOpacity
                style={S.btnSecondary}
                onPress={() => void onFollow(item.userId)}
                disabled={busy}
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
    [busyIds, onAddFriend, onFollow, openProfile],
  );

  return (
    <View style={S.root}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.back}>
          <Text style={S.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.title}>Suggestions</Text>
        <View style={S.back} />
      </View>

      {loading && items.length === 0 ? (
        <View style={S.centered}>
          <ActivityIndicator color={colors.primary} />
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
            <View style={S.empty}>
              <Text style={S.emptyTitle}>No suggestions yet</Text>
              <Text style={S.emptyBody}>
                Wave at people on the map, chat, or grow your friend graph — suggestions show up
                here.
              </Text>
            </View>
          }
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
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 12,
  },
  back: { width: 72 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  list: { padding: spacing.xl, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMeta: { flex: 1 },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md },
  reason: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.onPrimary, fontWeight: '700' },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '700' },
  btnGhost: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.textMuted, fontWeight: '600' },
  empty: { paddingTop: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  emptyBody: { color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
});
