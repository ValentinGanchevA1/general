import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { LeaderboardEntry, LeaderboardScope } from '@g88/shared';
import { useLeaderboard } from '@/features/gamification/useLeaderboard';
import { WeeklyRibbon } from '@/features/gamification/WeeklyRibbon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function Avatar({ entry }: { entry: LeaderboardEntry }): React.JSX.Element {
  if (entry.avatarUrl) return <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />;
  const initials = entry.displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <Text style={styles.avatarInitials}>{initials || '?'}</Text>
    </View>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }): React.JSX.Element {
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <Text style={styles.rank}>{MEDALS[entry.rank] ?? entry.rank}</Text>
      <Avatar entry={entry} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.displayName}
          {entry.isMe ? ' (you)' : ''}
        </Text>
        <Text style={styles.level}>Level {entry.level}</Text>
      </View>
      <Text style={styles.xp}>{entry.xp.toLocaleString()} XP</Text>
    </View>
  );
}

export function LeaderboardScreen(): React.JSX.Element {
  const [scope, setScope] = useState<LeaderboardScope>('weekly');
  const { page, loading, refresh } = useLeaderboard(scope);

  const meOffPage =
    page?.me != null && !page.entries.some((e) => e.userId === page.me!.userId);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Leaderboard" />

      <View style={styles.tabs}>
        {(['weekly', 'all_time'] as LeaderboardScope[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, scope === s && styles.tabActive]}
            onPress={() => setScope(s)}
          >
            <Text style={[styles.tabText, scope === s && styles.tabTextActive]}>
              {s === 'weekly' ? 'This week' : 'All time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#00d4ff" />}
      >
        {scope === 'weekly' && page?.resetsAt ? (
          <WeeklyRibbon resetsAt={page.resetsAt} me={page.me} />
        ) : null}

        {page == null && loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
        ) : page && page.entries.length === 0 ? (
          <EmptyState
            variant="plain"
            icon="trophy-outline"
            title="No ranked players yet"
            body="Earn XP to climb the leaderboard."
          />
        ) : (
          page?.entries.map((e) => <Row key={e.userId} entry={e} />)
        )}
      </ScrollView>

      {meOffPage && page?.me ? (
        <View style={styles.meFooter}>
          <Row entry={page.me} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 24 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#12121f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f1f33',
  },
  tabActive: { backgroundColor: '#00d4ff18', borderColor: '#00d4ff' },
  tabText: { color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#00d4ff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#12121f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 12,
  },
  rowMe: { borderColor: '#00d4ff', backgroundColor: '#00d4ff12' },
  rank: { color: '#fff', fontSize: 16, fontWeight: '700', width: 28, textAlign: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#00d4ff', fontWeight: '700' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  level: { color: '#888', fontSize: 12, marginTop: 2 },
  xp: { color: '#00d4ff', fontSize: 14, fontWeight: '700' },
  meFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    backgroundColor: '#0a0a0f',
  },
});
