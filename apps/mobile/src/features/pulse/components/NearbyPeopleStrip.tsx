// apps/mobile/src/features/pulse/components/NearbyPeopleStrip.tsx
//
// Horizontal strip of nearby user avatars, reading from existing discovery
// slice (no new fetch). Empty when the user hasn't visited Map yet — fine.
// "+N more" expands the strip so every nearby user is reachable.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { DiscoveryPoint, EntityPoint, UserMeta } from '@g88/shared';

import { Avatar } from '@/components/Avatar';

interface Props {
  points: DiscoveryPoint[];
  onTapUser: (userId: string) => void;
  /** How many avatars show before the "+N more" chip. Default 6. */
  maxVisible?: number;
}

export function NearbyPeopleStrip(props: Props): React.JSX.Element | null {
  const { points, onTapUser, maxVisible = 6 } = props;
  const [expanded, setExpanded] = useState(false);

  const users = useMemo<EntityPoint[]>(
    () => points.filter((p): p is EntityPoint => p.kind === 'user').slice(0, 50),
    [points],
  );

  if (users.length === 0) return null;

  const visible = expanded ? users : users.slice(0, maxVisible);
  const overflow = expanded ? 0 : Math.max(0, users.length - maxVisible);

  return (
    <View style={S.section}>
      <TouchableOpacity
        style={S.sectionHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? `Collapse nearby list, ${users.length} people`
            : `Nearby ${users.length} people. Tap to expand.`
        }
      >
        <Text style={S.sectionTitle}>{\u{1F31F}'} Nearby</Text>
        <Text style={S.sectionCount}>{users.length}</Text>
        {users.length > maxVisible ? (
          <Text style={S.expandHint}>{expanded ? 'Show less' : 'See all'}</Text>
        ) : null}
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.scroll}
      >
        {visible.map((u) => {
          const meta = u.meta as UserMeta;
          const name = meta.displayName ?? '?';
          const first = (name.split(' ')[0] ?? '').slice(0, 8);
          return (
            <TouchableOpacity
              key={u.id}
              style={S.userItem}
              onPress={() => onTapUser(u.id)}
              testID={`nearby-user-${u.id}`}
              accessibilityRole="button"
              accessibilityLabel={name}
            >
              <Avatar
                uri={meta.avatarUrl}
                name={name}
                size={48}
                online={meta.online === true}
              />
              <Text style={S.name} numberOfLines={1}>
                {first}
              </Text>
            </TouchableOpacity>
          );
        })}

        {overflow > 0 && (
          <TouchableOpacity
            style={S.userItem}
            onPress={() => setExpanded(true)}
            testID="nearby-more"
            accessibilityRole="button"
            accessibilityLabel={`Show ${overflow} more nearby people`}
          >
            <View style={[S.avatar, S.overflowAvatar]}>
              <Text style={S.overflowText}>+{overflow}</Text>
            </View>
            <Text style={S.name}>more</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  section: { paddingVertical: 8, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionCount: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
  },
  expandHint: { color: '#666', fontSize: 12, marginLeft: 'auto' },
  scroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 12 },
  userItem: { alignItems: 'center', width: 56 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowAvatar: { backgroundColor: '#0a0a0f' },
  overflowText: { color: '#aaa', fontWeight: '700', fontSize: 13 },
  name: { color: '#aaa', fontSize: 11, marginTop: 4, maxWidth: 56, textAlign: 'center' },
});
