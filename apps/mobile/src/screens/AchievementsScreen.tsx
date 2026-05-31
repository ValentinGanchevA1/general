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

import type { AchievementStatus } from '@g88/shared';
import { useAchievements } from '@/features/gamification/useAchievements';

function AchievementRow({ a }: { a: AchievementStatus }): React.JSX.Element {
  const pct = a.threshold > 0 ? Math.min(100, Math.round((a.progress / a.threshold) * 100)) : 0;
  return (
    <View style={[styles.row, a.unlocked && styles.rowUnlocked]}>
      <Text style={[styles.emoji, !a.unlocked && styles.emojiLocked]}>{a.icon}</Text>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{a.title}</Text>
          {a.unlocked ? <Icon name="check-decagram" size={16} color="#FFD700" /> : null}
        </View>
        <Text style={styles.desc}>{a.description}</Text>
        {!a.unlocked ? (
          <>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {a.progress}/{a.threshold}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function AchievementsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { achievements, loading, refresh } = useAchievements();
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

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
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.back} />
      </View>

      {achievements.length > 0 ? (
        <Text style={styles.summary}>
          {unlockedCount} of {achievements.length} unlocked
        </Text>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
      ) : null}

      {achievements.map((a) => (
        <AchievementRow key={a.id} a={a} />
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
  row: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#12121f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 14,
    opacity: 0.7,
  },
  rowUnlocked: { opacity: 1, borderColor: '#FFD70040' },
  emoji: { fontSize: 32 },
  emojiLocked: { opacity: 0.4 },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  desc: { color: '#888', fontSize: 13 },
  barTrack: { height: 6, backgroundColor: '#1f1f33', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 6, backgroundColor: '#00d4ff', borderRadius: 3 },
  progressText: { color: '#666', fontSize: 11, marginTop: 4 },
});
