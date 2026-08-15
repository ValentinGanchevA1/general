import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GamificationSummary } from '@g88/shared';
import { colors, spacing, radius, fontSize } from '@/theme';

export function ProfileProgressCard({
  summary,
}: {
  summary: GamificationSummary;
}): React.JSX.Element {
  const pct =
    summary.xpForNextLevel > 0
      ? Math.min(100, Math.round((summary.xpIntoLevel / summary.xpForNextLevel) * 100))
      : 0;
  return (
    <View style={styles.card}>
      <View style={styles.progressRow}>
        <Text style={styles.levelText}>Level {summary.level}</Text>
        <Text style={styles.xpText}>{summary.totalXp.toLocaleString()} XP</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.subText}>
          {summary.xpIntoLevel}/{summary.xpForNextLevel} to Lvl {summary.level + 1}
        </Text>
        {summary.currentStreak > 0 ? (
          <Text style={styles.streakText}>🔥 {summary.currentStreak}-day streak</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 8,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md },
  xpText: { color: colors.textMuted, fontSize: fontSize.sm },
  barTrack: {
    height: 8,
    backgroundColor: colors.borderStrong,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  subText: { color: colors.textMuted, fontSize: fontSize.xs },
  streakText: { color: colors.warning, fontSize: fontSize.xs, fontWeight: '600' },
});
