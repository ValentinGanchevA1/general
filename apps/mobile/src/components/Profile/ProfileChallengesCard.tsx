import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChallengeToday } from '@g88/shared';
import { colors, spacing, radius, fontSize } from '@/theme';

export function ProfileChallengesCard({
  challenges,
}: {
  challenges: ChallengeToday[];
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Today's challenges</Text>
      {challenges.map((c) => (
        <View key={c.id} style={styles.challengeRow}>
          <Text style={[styles.checkbox, c.completed && styles.checkboxDone]}>
            {c.completed ? '☑' : '☐'}
          </Text>
          <Text style={[styles.challengeTitle, c.completed && styles.challengeTitleDone]}>
            {c.title}
          </Text>
          <Text style={styles.challengeReward}>
            {c.completed ? `+${c.rewardXp}` : String(c.progress) + '/' + String(c.target)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 8,
  },
  cardHeader: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { color: colors.textMuted, fontSize: 16, width: 22 },
  checkboxDone: { color: colors.success },
  challengeTitle: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm },
  challengeTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  challengeReward: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
});
