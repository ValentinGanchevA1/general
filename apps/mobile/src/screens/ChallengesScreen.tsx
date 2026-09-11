import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ChallengeToday } from '@g88/shared';
import { useChallenges } from '@/features/gamification/useChallenges';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import { colors } from '@/theme';

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
          color={c.completed ? colors.bg : colors.primary}
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
  const { challenges, loading, refresh } = useChallenges();
  const completedCount = challenges.filter((c) => c.completed).length;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Challenges" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {challenges.length > 0 ? (
          <Text style={styles.summary}>
            {completedCount} of {challenges.length} completed today · resets at midnight
          </Text>
        ) : loading ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : (
          <EmptyState
            variant="plain"
            icon="flag-outline"
            title="No challenges right now"
            body="Check back tomorrow for new daily goals."
          />
        )}

        {challenges.map((c) => (
          <ChallengeRow key={c.id} c={c} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  summary: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  rowDone: { borderColor: colors.primaryBorderSoft, backgroundColor: colors.primarySoft },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMutedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapDone: { backgroundColor: colors.primary },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  rewardPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.premiumMutedBg,
    borderRadius: 12,
  },
  rewardText: { color: colors.premium, fontSize: 12, fontWeight: '700' },
  doneText: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  barTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
});
