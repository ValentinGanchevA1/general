import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  interests?: string[];
  goals?: string[];
  /** Label for goals block. Self: "Looking for"; public often "Goals". */
  goalsTitle?: string;
  /** When false, skip horizontal padding. Default true. */
  padded?: boolean;
}

export function ProfileTagsSection({
  interests = [],
  goals = [],
  goalsTitle = 'Looking for',
  padded = true,
}: Props): React.JSX.Element | null {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (interests.length === 0 && goals.length === 0) return null;
  return (
    <>
      {interests.length > 0 ? (
        <View style={[styles.section, padded && styles.padded]}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.tagsContainer}>
            {interests.map((interest, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {goals.length > 0 ? (
        <View style={[styles.section, padded && styles.padded]}>
          <Text style={styles.sectionTitle}>{goalsTitle}</Text>
          <View style={styles.tagsContainer}>
            {goals.map((goal, index) => {
              const cfg = GOAL_OPTIONS.find((g) => g.value === goal);
              return (
                <View key={index} style={styles.goalTag}>
                  <Text style={styles.goalIcon}>{cfg?.icon ?? '🎯'}</Text>
                  <Text style={styles.goalText}>{cfg?.label ?? goal}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginTop: spacing.lg },
    padded: { paddingHorizontal: spacing.xl },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    tagText: { color: colors.textPrimary, fontSize: 14 },
    goalTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      gap: 8,
    },
    goalIcon: { fontSize: 16 },
    goalText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  });
}
