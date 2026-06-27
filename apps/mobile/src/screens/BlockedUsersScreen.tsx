import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BlockedUser } from '@g88/shared';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { deleteJson, getJson } from '@/api/client';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    void (async () => {
      try {
        setUsers(await getJson<BlockedUser[]>('/blocks'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { load(); }, [load]);

  const unblock = async (id: string): Promise<void> => {
    setPendingId(id);
    try {
      await deleteJson<{ blocked: boolean }>(`/blocks/${id}`);
      setUsers((list) => list.filter((u) => u.id !== id));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Blocked users</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#00d4ff" size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>
              You haven't blocked anyone. Blocked users don't appear on your map and can't message you.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <InitialsAvatar name={item.displayName} />
              <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
              <TouchableOpacity
                style={[styles.unblockBtn, pendingId === item.id && styles.unblockBtnDisabled]}
                onPress={() => void unblock(item.id)}
                disabled={pendingId === item.id}
              >
                {pendingId === item.id ? (
                  <ActivityIndicator color="#00d4ff" size="small" />
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
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtnText: { color: '#00d4ff', fontSize: 17, fontWeight: '600', width: 60 },
  heading: { color: '#fff', fontSize: 17, fontWeight: '700' },
  spacer: { width: 60 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  empty: { color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#00d4ff66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#00d4ff', fontSize: 15, fontWeight: '700' },
  name: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00d4ff66',
    minWidth: 92,
    alignItems: 'center',
  },
  unblockBtnDisabled: { opacity: 0.6 },
  unblockText: { color: '#00d4ff', fontWeight: '700', fontSize: 14 },
});
