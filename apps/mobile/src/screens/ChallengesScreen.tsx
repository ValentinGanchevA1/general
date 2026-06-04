import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ChallengeToday } from '@g88/shared';
import { useChallenges } from '@/features/gamification/useChallenges';

// ChallengeToday carries no icon (the catalog keys on `metric`, which the
// today-endpoint strips), so derive one from the id prefix. Falls back to a
// generic target icon for ids we don't recognise.
function iconForChallenge(id: string): string {
  if (id.startsWith('wave')) return 'hand-wave';
  if (id.startsWith('match')) return 'heart';
  if (id.startsWith('alert')) return 'bullhorn';
  if (id.startsWith('chat')) return 'message-text';
  return 'checkbox-marked-circle-outline';
}

function ChallengeRow({ c }: { c: ChallengeToday }): React.JSX.Element {
  const pct = c.target > 0 ? Math.min(100, Math.round((c.progress / c.target) * 100)) : 0;
  return (
    <View style={[styles.row, c.completed && styles.rowDone]}>
      <View style={[styles.iconWrap, c.completed && styles.iconWrapDone]}>
        <Icon
          name={c.completed ? 'check-bold' : iconForChallenge(c.id)}
          size={22}
          color={c.completed ? '#0a0a0f' : '#00d4ff'}
        />
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{c.title}</Text>
          <View style={styles.rewardPill}>
            <Text style={styles.rewardText}>+{c.rewardXp} XP</Text>
          </View>
        </View>
        {c.completed ? (
          <Text style={styles.doneText}>Completed</Text>
        ) : (
          <>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {c.progress}/{c.target}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

export function ChallengesScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { challenges, loading, refresh } = useChallenges();
  const completedCount = challenges.filter((c) => c.completed).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#00d4ff" />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenges</Text>
        <View style={styles.back} />
      </View>

      {challenges.length > 0 ? (
        <Text style={styles.summary}>
          {completedCount} of {challenges.length} completed today · resets at midnight
        </Text>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
      ) : (
        <Text style={styles.empty}>No challenges right now. Check back tomorrow!</Text>
      )}

      {challenges.map((c) => (
        <ChallengeRow key={c.id} c={c} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  summary: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  empty: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#12121f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 14,
  },
  rowDone: { borderColor: '#00d4ff40', backgroundColor: '#00d4ff12' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00d4ff18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapDone: { backgroundColor: '#00d4ff' },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  rewardPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#FFD70018',
    borderRadius: 12,
  },
  rewardText: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  doneText: { color: '#00d4ff', fontSize: 13, fontWeight: '600', marginTop: 2 },
  barTrack: { height: 6, backgroundColor: '#1f1f33', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 6, backgroundColor: '#00d4ff', borderRadius: 3 },
  progressText: { color: '#666', fontSize: 11, marginTop: 4 },
});
