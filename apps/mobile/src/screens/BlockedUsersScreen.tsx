import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import type { BlockedUser } from '@g88/shared';

import { deleteJson, getJson } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, spacing, radius, fontSize } from '@/theme';

function InitialsAvatar({ name }: { name: string }): React.JSX.Element {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function BlockedUsersScreen(): React.JSX.Element {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  // Track every in-flight unblock by id so rapid taps on different rows don't
  // clobber each other's spinner state.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    void (async () => {
      try {
        setUsers(await getJson<BlockedUser[]>('/blocks'));
      } catch {
        appAlert('Error', 'Could not load blocked users. Try again in a moment.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { load(); }, [load]);

  const unblock = async (id: string): Promise<void> => {
    setPendingIds((s) => new Set(s).add(id));
    try {
      await deleteJson<{ blocked: boolean }>(`/blocks/${id}`);
      setUsers((list) => list.filter((u) => u.id !== id));
    } catch {
      appAlert('Error', 'Could not unblock. Try again in a moment.');
    } finally {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Blocked users" bordered />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              variant="plain"
              icon="account-cancel-outline"
              title="No blocked users"
              body="Blocked users don't appear on your map and can't message you."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <InitialsAvatar name={item.displayName} />
              <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
              <TouchableOpacity
                style={[styles.unblockBtn, pendingIds.has(item.id) && styles.unblockBtnDisabled]}
                onPress={() => void unblock(item.id)}
                disabled={pendingIds.has(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.displayName}`}
              >
                {pendingIds.has(item.id) ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.primary + '66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  name: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' },
  unblockBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '66',
    minWidth: 92,
    alignItems: 'center',
  },
  unblockBtnDisabled: { opacity: 0.6 },
  unblockText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm + 1 },
});
