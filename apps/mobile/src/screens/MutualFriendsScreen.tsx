// apps/mobile/src/screens/MutualFriendsScreen.tsx
// Mutual close friends of viewer and a peer (intersection only).
// Entry: UserProfile → mutual friends line.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  InteractionManager,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { FriendCard, FriendsPage } from '@g88/shared';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import { colors, spacing, radius, fontSize } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MutualFriends'>;

export function MutualFriendsScreen({ route, navigation }: Props): React.JSX.Element {
  const { peerUserId, peerName } = route.params;
  const [items, setItems] = useState<FriendCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      const append = Boolean(cursor);
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const page = await getJson<FriendsPage>(`/friends/mutual/${peerUserId}${qs}`);
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch {
        if (!append) setError('Could not load mutual friends.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [peerUserId],
  );

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      void load();
    });
    return () => {
      if (typeof handle?.cancel === 'function') handle.cancel();
    };
  }, [load]);

  const openProfile = useCallback(
    (userId: string) => {
      navigation.push('UserProfile', { userId });
    },
    [navigation],
  );

  const title = peerName ? `Mutual with ${peerName}` : 'Mutual friends';

  const renderItem = useCallback(
    ({ item }: { item: FriendCard }) => (
      <TouchableOpacity
        style={S.row}
        onPress={() => openProfile(item.userId)}
        accessibilityRole="button"
        accessibilityLabel={`Open profile for ${item.displayName}`}
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
      </TouchableOpacity>
    ),
    [openProfile],
  );

  return (
    <View style={S.root}>
      <ScreenHeader title={title} />

      {loading && items.length === 0 ? (
        <View style={S.listContent}>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
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
          onEndReached={() => {
            if (nextCursor && !loadingMore && !loading) {
              void load(nextCursor);
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              variant="plain"
              icon="account-group-outline"
              title="No mutual friends yet"
              body={`When you and ${peerName ?? 'this person'} share close friends, they show up here.`}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : null
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
  errorText: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
});
