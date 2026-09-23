import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ApiError, SuggestionCard } from '@g88/shared';

import { getJson, postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { colors, fontSize, radius, spacing } from '@/theme';

function shortReason(item: SuggestionCard): string {
  const n = item.mutualFriendsCount ?? 0;
  switch (item.reason) {
    case 'mutual_friends':
      return n <= 0 ? 'Mutual' : n === 1 ? '1 mutual' : `${n} mutual`;
    case 'recent_wave':
      return 'Recent wave';
    case 'recent_chat':
      return 'Recent chat';
    case 'nearby':
      return 'Nearby';
    case 'shared_interests': {
      const c = item.sharedInterestsCount ?? 0;
      return c > 0 ? `${c} shared` : 'Shared interests';
    }
    default:
      return 'Suggested';
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

interface Props {
  onSeeAll: () => void;
  onOpenProfile: (userId: string) => void;
  /** Hide rail when empty after load (default true). */
  hideWhenEmpty?: boolean;
}

/**
 * Compact horizontal "People you may know" strip for Friends list header.
 * Rank C API + Add friend; full list lives on SuggestionsScreen.
 */
export function FriendsSuggestionsRail({
  onSeeAll,
  onOpenProfile,
  hideWhenEmpty = true,
}: Props): React.JSX.Element | null {
  const [items, setItems] = useState<SuggestionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJson<SuggestionCard[]>('/friends/suggestions?limit=8');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
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

  const onAdd = useCallback(
    async (userId: string) => {
      setBusyId(userId);
      try {
        await postJson<{ userId: string }, { requestId: string }>('/friends/requests', {
          userId,
        });
        setItems((prev) =>
          prev.map((c) =>
            c.userId === userId ? { ...c, hasPendingOutgoing: true } : c,
          ),
        );
      } catch (e) {
        if (isApiError(e) && e.code === 'friends.already_friends') {
          setItems((prev) => prev.filter((c) => c.userId !== userId));
        } else if (isApiError(e) && e.code === 'friends.request_pending') {
          setItems((prev) =>
            prev.map((c) =>
              c.userId === userId ? { ...c, hasPendingOutgoing: true } : c,
            ),
          );
        }
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>People you may know</Text>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      </View>
    );
  }

  if (hideWhenEmpty && items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>People you may know</Text>
        <TouchableOpacity
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="See all suggestions"
        >
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.userId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const busy = busyId === item.userId;
          const verified =
            item.verification === 'id' || item.verification === 'phone';
          return (
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => onOpenProfile(item.userId)}
                accessibilityRole="button"
                accessibilityLabel={`Open profile for ${item.displayName}`}
                style={styles.cardTap}
              >
                <View style={styles.avatarWrap}>
                  <Avatar uri={item.avatarUrl} name={item.displayName} size={56} />
                  {verified ? (
                    <View style={styles.verifiedPip}>
                      <Icon name="check-decagram" size={14} color={colors.accent} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.reason} numberOfLines={1}>
                  {shortReason(item)}
                </Text>
              </TouchableOpacity>
              {item.hasPendingOutgoing ? (
                <View style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>Requested</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addBtn}
                  disabled={busy}
                  onPress={() => void onAdd(item.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.displayName} as friend`}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.addText}>Add</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  loadingRow: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    width: 112,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardTap: { alignItems: 'center', width: '100%' },
  avatarWrap: { marginBottom: 6 },
  verifiedPip: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 96,
  },
  reason: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: 96,
  },
  addBtn: {
    backgroundColor: colors.action,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    minWidth: 64,
    alignItems: 'center',
  },
  addText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  ghostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ghostText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
