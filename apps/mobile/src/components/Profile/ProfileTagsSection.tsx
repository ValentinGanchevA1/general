import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { interestLabel } from '@/features/profile/interestOptions';
import { PURPOSE_OPTIONS } from '@/features/profile/goalOptions';
import { spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  interests?: string[];
  /** Persisted as `goals`; user-facing concept is Purpose. */
  goals?: string[];
  purposeTitle?: string;
  /** @deprecated Compatibility alias. Prefer purposeTitle. */
  goalsTitle?: string;
  /** When false, skip horizontal padding. Default true. */
  padded?: boolean;
}

export function ProfileTagsSection({
  interests = [],
  goals = [],
  purposeTitle,
  goalsTitle,
  padded = true,
}: Props): React.JSX.Element | null {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolvedPurposeTitle = purposeTitle ?? (goalsTitle === 'Goals' ? 'Purpose' : goalsTitle) ?? 'Purpose';

  if (interests.length === 0 && goals.length === 0) return null;

  return (
    <>
      {interests.length > 0 ? (
        <View style={[styles.section, padded && styles.padded]}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.tagsContainer}>
            {interests.map((interest) => (
              <View key={interest} style={styles.tag}>
                <Text style={styles.tagText}>{interestLabel(interest)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {goals.length > 0 ? (
        <View style={[styles.section, padded && styles.padded]}>
          <Text style={styles.sectionTitle}>{resolvedPurposeTitle}</Text>
          <View style={styles.tagsContainer}>
            {goals.map((goal) => {
              const cfg = PURPOSE_OPTIONS.find((option) => option.value === goal);
              return (
                <View key={goal} style={styles.purposeTag}>
                  <Text style={styles.purposeIcon}>{cfg?.icon ?? '🎯'}</Text>
                  <Text style={styles.purposeText}>{cfg?.label ?? goal}</Text>
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
    purposeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      gap: 8,
    },
    purposeIcon: { fontSize: 16 },
    purposeText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  });
}
