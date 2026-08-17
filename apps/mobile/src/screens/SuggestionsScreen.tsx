// apps/mobile/src/screens/SuggestionsScreen.tsx
// People you may know — FoF, recent wave, recent chat.
// Entry: FriendsList header / empty-state CTA.

import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { SuggestionCard, SuggestionReason } from '@g88/shared';

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
      setItems(data);
    } catch {
      setError('Could not load suggestions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

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

  const onFollow = useCallback(
    async (userId: string) => {
      setBusy(userId, true);
      try {
        await postJson<{ userId: string }, { following: true }>('/friends/follow', { userId });
        setItems((prev) =>
          prev.map((c) => (c.userId === userId ? { ...c, isFollowing: true } : c)),
        );
      } catch {
        Alert.alert('Could not follow', 'Try again.');
      } finally {
        setBusy(userId, false);
      }
    },
    [setBusy],
  );

  const onAddFriend = useCallback(
    async (userId: string) => {
      setBusy(userId, true);
      try {
        await postJson<{ userId: string }, { requestId: string }>('/friends/requests', {
          userId,
        });
        setItems((prev) =>
          prev.map((c) =>
            c.userId === userId ? { ...c, hasPendingOutgoing: true } : c,
          ),
        );
      } catch {
        Alert.alert('Could not send request', 'Try again.');
      } finally {
        setBusy(userId, false);
      }
    },
    [setBusy],
  );

  const renderItem = useCallback(
    ({ item }: { item: SuggestionCard }) => {
      const busy = busyIds.includes(item.userId);
      return (
        <View style={S.row}>
          <TouchableOpacity onPress={() => openProfile(item.userId)} accessibilityRole="button">
            <Avatar uri={item.avatarUrl} name={item.displayName} size={44} />
          </TouchableOpacity>
          <TouchableOpacity
            style={S.rowBody}
            onPress={() => openProfile(item.userId)}
            accessibilityRole="button"
          >
            <Text style={S.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={S.meta} numberOfLines={1}>
              {reasonLabel(item.reason, item.mutualFriendsCount)}
            </Text>
          </TouchableOpacity>
          <View style={S.actions}>
            {!item.isFollowing ? (
              <TouchableOpacity
                style={[S.secondaryBtn, busy && S.btnDisabled]}
                disabled={busy}
                onPress={() => void onFollow(item.userId)}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={S.secondaryBtnText}>Follow</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={S.secondaryBtn}>
                <Text style={S.secondaryBtnText}>Following</Text>
              </View>
            )}
            {item.hasPendingOutgoing ? (
              <View style={S.pendingChip}>
                <Text style={S.pendingChipText}>Pending</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[S.primaryBtn, busy && S.btnDisabled]}
                disabled={busy}
                onPress={() => void onAddFriend(item.userId)}
              >
                <Text style={S.primaryBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [busyIds, openProfile, onFollow, onAddFriend],
  );

  return (
    <View style={S.root}>
      <View style={S.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={S.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.heading}>Suggestions</Text>
        <View style={S.spacer} />
      </View>

      {loading && items.length === 0 ? (
        <View style={S.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error && items.length === 0 ? (
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity style={S.retry} onPress={() => void load()}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={S.listContent}
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
              <Text style={S.emptyHint}>
                Wave at people on the map, chat, or grow your friend graph — suggestions show up
                here.
              </Text>
            </View>
          }
          renderItem={renderItem}
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
  spacer: { width: 64 },

  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    gap: 10,
  },
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

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
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
  pendingChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  pendingChipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
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
  errorText: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
});
