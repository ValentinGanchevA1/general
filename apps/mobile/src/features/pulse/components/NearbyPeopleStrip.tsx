// apps/mobile/src/features/pulse/components/NearbyPeopleStrip.tsx
//
// Horizontal strip of nearby user avatars, reading from existing discovery
// slice (no new fetch). Empty when the user hasn't visited Map yet — fine.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { DiscoveryPoint, EntityPoint, UserMeta } from '@g88/shared';

interface Props {
  points: DiscoveryPoint[];
  onTapUser: (userId: string) => void;
  maxVisible?: number;
}

export function NearbyPeopleStrip(props: Props): React.JSX.Element | null {
  const { points, onTapUser, maxVisible = 6 } = props;

  const users = useMemo<EntityPoint[]>(
    () => points.filter((p): p is EntityPoint => p.kind === 'user').slice(0, 50),
    [points],
  );

  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = Math.max(0, users.length - maxVisible);

  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{'\u{1F31F}'} Nearby</Text>
        <Text style={S.sectionCount}>{users.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.scroll}
      >
        {visible.map((u) => {
          const meta = u.meta as UserMeta;
          const name = meta.displayName ?? '?';
          const initials = name
            .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
          const online = meta.online === true;
          return (
            <TouchableOpacity
              key={u.id}
              style={S.userItem}
              onPress={() => onTapUser(u.id)}
              testID={`nearby-user-${u.id}`}
            >
              <View style={S.avatarWrap}>
                <View style={S.avatar}>
                  <Text style={S.avatarText}>{initials}</Text>
                </View>
                {online && <View style={S.onlineDot} />}
              </View>
              <Text style={S.name} numberOfLines={1}>
                {(name.split(' ')[0] ?? '').slice(0, 8)}
              </Text>
            </TouchableOpacity>
          );
        })}
        {overflow > 0 && (
          <View style={S.userItem}>
            <View style={[S.avatar, S.overflowAvatar]}>
              <Text style={S.overflowText}>+{overflow}</Text>
            </View>
            <Text style={S.name}>more</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  section: { paddingTop: 8, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 6,
  },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionCount: {
    color: '#00d4ff', fontSize: 12, fontWeight: '700',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8,
  },
  scroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 12 },
  userItem: { alignItems: 'center', width: 56 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1a1a2e',
    borderWidth: 2, borderColor: '#2a2a4a',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#00d4ff', fontWeight: '700', fontSize: 15 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2, borderColor: '#0a0a0f',
  },
  overflowAvatar: { backgroundColor: '#0a0a0f' },
  overflowText: { color: '#aaa', fontWeight: '700', fontSize: 13 },
  name: { color: '#aaa', fontSize: 11, marginTop: 4, maxWidth: 56 },
});
